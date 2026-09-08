import dns from "node:dns/promises";
import net from "node:net";
import os from "node:os";
import WebSocket from "ws";
import type { IntegrationId } from "@/lib/integrations";
import { logger } from "@/lib/logger";

const TCP_TIMEOUT_MS = 300;
const WS_PROBE_TIMEOUT_MS = 800;
const HTTP_PROBE_TIMEOUT_MS = 800;
const SCAN_BUDGET_MS = 8_000;
const CONCURRENCY = 64;

const NEXT_PORT = 5702;
const NEXT_MOCK_PORT = 9400;
const RH_PORT = 5000;
const RH_HTTP_PORT = 80;
const RH_MDNS_HOST = "rotorhazard.local";

export type DetectSource = "scan" | "mdns" | "localhost";

export type DetectCandidate = {
  url: string;
  source: DetectSource;
  label: string;
};

export type DetectResult = {
  provider: "next" | "rotorhazard";
  candidates: DetectCandidate[];
};

type HostPort = { host: string; port: number };

let inflight: Promise<DetectResult> | null = null;
let inflightProvider: "next" | "rotorhazard" | null = null;

/** True for private IPv4 used on race WiFi / lab LANs. */
export function isRfc1918(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Expand a host to the other 253 usable addresses in its /24 (excludes .0 and .255). */
export function hostsInSlash24(ip: string): string[] {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return [];
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const hosts: string[] = [];
  for (let i = 1; i <= 254; i++) {
    hosts.push(`${prefix}.${i}`);
  }
  return hosts;
}

/**
 * IPv4 addresses to scan: each NIC's RFC1918 /24 (capped even if prefix is larger),
 * plus loopback for local mocks.
 */
export function listScanHosts(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): string[] {
  const lan = new Set<string>();

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      const family = String(entry.family);
      const isV4 = family === "IPv4" || family === "4";
      if (!isV4 || entry.internal) continue;
      if (!isRfc1918(entry.address)) continue;
      for (const host of hostsInSlash24(entry.address)) {
        lan.add(host);
      }
    }
  }

  const sortedLan = [...lan].sort(compareIp);
  return ["127.0.0.1", ...sortedLan];
}

export function compareIp(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isEngineIoHandshake(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith("0")) return false;
  try {
    const payload = JSON.parse(trimmed.slice(1)) as { sid?: unknown };
    return typeof payload.sid === "string" && payload.sid.length > 0;
  } catch {
    return false;
  }
}

export function looksLikeRotorHazardHtml(body: string): boolean {
  return /rotorhazard/i.test(body);
}

/** Rank Next candidates: LAN :5702 first, loopback / mock last. */
export function rankNextCandidates(
  candidates: DetectCandidate[],
): DetectCandidate[] {
  return [...candidates].sort((a, b) => {
    const score = (c: DetectCandidate) => {
      if (c.source === "localhost") return 100;
      try {
        const u = new URL(c.url);
        if (u.port === String(NEXT_MOCK_PORT)) return 90;
        return 0;
      } catch {
        return 50;
      }
    };
    const d = score(a) - score(b);
    if (d !== 0) return d;
    return a.url.localeCompare(b.url);
  });
}

/** Rank RH candidates: mDNS first, then :5000, then :80. */
export function rankRotorHazardCandidates(
  candidates: DetectCandidate[],
): DetectCandidate[] {
  return [...candidates].sort((a, b) => {
    const score = (c: DetectCandidate) => {
      if (c.source === "mdns") return 0;
      try {
        const u = new URL(c.url);
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        if (port === String(RH_PORT)) return 10;
        if (port === String(RH_HTTP_PORT) || port === "") return 20;
        return 30;
      } catch {
        return 40;
      }
    };
    const d = score(a) - score(b);
    if (d !== 0) return d;
    return a.url.localeCompare(b.url);
  });
}

export function tcpOpen(
  host: string,
  port: number,
  timeoutMs = TCP_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export function probeNextWebSocket(
  host: string,
  port: number,
  timeoutMs = WS_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const url = `ws://${host}:${port}/`;
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ws) {
        ws.removeAllListeners();
        try {
          ws.terminate();
        } catch {
          /* ignore */
        }
      }
      resolve(ok);
    };

    try {
      ws = new WebSocket(url);
    } catch {
      resolve(false);
      return;
    }

    const timer = setTimeout(() => done(false), timeoutMs);
    ws.once("open", () => {
      clearTimeout(timer);
      done(true);
    });
    ws.once("unexpected-response", () => {
      clearTimeout(timer);
      done(false);
    });
    ws.once("error", () => {
      clearTimeout(timer);
      done(false);
    });
  });
}

export async function probeRotorHazardHttp(
  host: string,
  port: number,
  timeoutMs = HTTP_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const origin = `http://${host}:${port}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const pageRes = await fetch(`${origin}/`, {
      signal: controller.signal,
      redirect: "follow",
    });
    const pageText = await pageRes.text().catch(() => "");
    if (looksLikeRotorHazardHtml(pageText)) return true;

    const sioRes = await fetch(
      `${origin}/socket.io/?EIO=4&transport=polling`,
      { signal: controller.signal, redirect: "follow" },
    );
    const sioText = await sioRes.text().catch(() => "");
    return isEngineIoHandshake(sioText);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
  shouldStop: () => boolean,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (true) {
      if (shouldStop()) return;
      const i = index++;
      if (i >= items.length) return;
      const value = await fn(items[i]);
      if (value != null) results.push(value);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function detectNext(deadline: number): Promise<DetectCandidate[]> {
  const hosts = listScanHosts();
  const targets: HostPort[] = [];

  for (const host of hosts) {
    if (host === "127.0.0.1") {
      targets.push({ host, port: NEXT_PORT });
      targets.push({ host, port: NEXT_MOCK_PORT });
    } else {
      targets.push({ host, port: NEXT_PORT });
    }
  }

  const found = await mapPool(
    targets,
    CONCURRENCY,
    async ({ host, port }) => {
      if (Date.now() >= deadline) return null;
      const open = await tcpOpen(host, port);
      if (!open) return null;
      if (Date.now() >= deadline) return null;
      const ok = await probeNextWebSocket(host, port);
      if (!ok) return null;
      const source: DetectSource =
        host === "127.0.0.1" ? "localhost" : "scan";
      const label =
        port === NEXT_MOCK_PORT
          ? "Local mock Next WebSocket"
          : host === "127.0.0.1"
            ? "Local Next WebSocket"
            : `Next on ${host}`;
      return {
        url: `ws://${host}:${port}`,
        source,
        label,
      } satisfies DetectCandidate;
    },
    () => Date.now() >= deadline,
  );

  return rankNextCandidates(dedupeByUrl(found));
}

async function resolveRotorHazardMdns(): Promise<string | null> {
  try {
    const { address } = await dns.lookup(RH_MDNS_HOST, { family: 4 });
    return address;
  } catch {
    return null;
  }
}

async function detectRotorHazard(
  deadline: number,
): Promise<DetectCandidate[]> {
  const candidates: DetectCandidate[] = [];
  const scanned = new Set<string>();

  const mdnsIp = await resolveRotorHazardMdns();
  if (mdnsIp && Date.now() < deadline) {
    for (const port of [RH_PORT, RH_HTTP_PORT]) {
      if (Date.now() >= deadline) break;
      const key = `${mdnsIp}:${port}`;
      scanned.add(key);
      const open = await tcpOpen(mdnsIp, port);
      if (!open) continue;
      const ok = await probeRotorHazardHttp(mdnsIp, port);
      if (!ok) continue;
      candidates.push({
        url:
          port === RH_HTTP_PORT
            ? `http://${RH_MDNS_HOST}`
            : `http://${RH_MDNS_HOST}:${port}`,
        source: "mdns",
        label: `RotorHazard via ${RH_MDNS_HOST}`,
      });
    }
  }

  const hosts = listScanHosts().filter((h) => h !== "127.0.0.1");
  const targets: HostPort[] = hosts
    .filter((host) => !scanned.has(`${host}:${RH_PORT}`))
    .map((host) => ({ host, port: RH_PORT }));

  // Also try localhost :5000 for lab installs.
  targets.unshift({ host: "127.0.0.1", port: RH_PORT });

  const scannedHits = await mapPool(
    targets,
    CONCURRENCY,
    async ({ host, port }) => {
      if (Date.now() >= deadline) return null;
      const open = await tcpOpen(host, port);
      if (!open) return null;
      if (Date.now() >= deadline) return null;
      const ok = await probeRotorHazardHttp(host, port);
      if (!ok) return null;
      const source: DetectSource =
        host === "127.0.0.1" ? "localhost" : "scan";
      return {
        url: `http://${host}:${port}`,
        source,
        label:
          host === "127.0.0.1"
            ? "Local RotorHazard"
            : `RotorHazard on ${host}`,
      } satisfies DetectCandidate;
    },
    () => Date.now() >= deadline,
  );

  return rankRotorHazardCandidates(
    dedupeByUrl([...candidates, ...scannedHits]),
  );
}

function dedupeByUrl(candidates: DetectCandidate[]): DetectCandidate[] {
  const seen = new Set<string>();
  const out: DetectCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

/**
 * Scan the race LAN for the selected race manager.
 * One scan at a time; returns whatever was confirmed within the budget.
 */
export async function detectRaceManager(
  provider: Extract<IntegrationId, "next" | "rotorhazard">,
): Promise<DetectResult> {
  if (inflight && inflightProvider === provider) {
    logger.info("race-manager-detect", "reusing in-flight scan");
    return inflight;
  }
  if (inflight) {
    await inflight.catch(() => undefined);
  }

  inflightProvider = provider;
  inflight = (async () => {
    const deadline = Date.now() + SCAN_BUDGET_MS;
    logger.info("race-manager-detect", `scanning for ${provider}`);
    try {
      const candidates =
        provider === "next"
          ? await detectNext(deadline)
          : await detectRotorHazard(deadline);
      logger.info(
        "race-manager-detect",
        `found ${candidates.length} candidate(s) for ${provider}`,
      );
      return { provider, candidates };
    } finally {
      inflight = null;
      inflightProvider = null;
    }
  })();

  return inflight;
}
