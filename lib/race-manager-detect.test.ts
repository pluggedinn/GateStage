import assert from "node:assert/strict";
import http from "node:http";
import type os from "node:os";
import { describe, test } from "node:test";
import { WebSocketServer } from "ws";
import {
  compareIp,
  hostsInSlash24,
  isEngineIoHandshake,
  isRfc1918,
  listScanHosts,
  looksLikeRotorHazardHtml,
  probeNextWebSocket,
  probeRotorHazardHttp,
  rankNextCandidates,
  rankRotorHazardCandidates,
  tcpOpen,
} from "./race-manager-detect";

describe("isRfc1918", () => {
  test("accepts private ranges", () => {
    assert.equal(isRfc1918("10.0.0.1"), true);
    assert.equal(isRfc1918("172.16.5.1"), true);
    assert.equal(isRfc1918("172.31.255.1"), true);
    assert.equal(isRfc1918("192.168.1.10"), true);
  });

  test("rejects public and invalid", () => {
    assert.equal(isRfc1918("8.8.8.8"), false);
    assert.equal(isRfc1918("172.15.0.1"), false);
    assert.equal(isRfc1918("172.32.0.1"), false);
    assert.equal(isRfc1918("127.0.0.1"), false);
    assert.equal(isRfc1918("not-an-ip"), false);
  });
});

describe("hostsInSlash24", () => {
  test("expands to 254 hosts excluding network/broadcast", () => {
    const hosts = hostsInSlash24("192.168.4.50");
    assert.equal(hosts.length, 254);
    assert.equal(hosts[0], "192.168.4.1");
    assert.equal(hosts[253], "192.168.4.254");
    assert.ok(!hosts.includes("192.168.4.0"));
    assert.ok(!hosts.includes("192.168.4.255"));
  });
});

describe("listScanHosts", () => {
  test("includes loopback and RFC1918 /24 from NICs; skips public", () => {
    const fake: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
      en0: [
        {
          address: "192.168.1.20",
          netmask: "255.255.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: false,
          cidr: "192.168.1.20/16",
        },
      ],
      eth0: [
        {
          address: "8.8.8.8",
          netmask: "255.255.255.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: false,
          cidr: "8.8.8.8/24",
        },
      ],
      lo0: [
        {
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        },
      ],
    };

    const hosts = listScanHosts(fake);
    assert.equal(hosts[0], "127.0.0.1");
    assert.ok(hosts.includes("192.168.1.1"));
    assert.ok(hosts.includes("192.168.1.254"));
    assert.ok(!hosts.includes("192.168.2.1"));
    assert.ok(!hosts.includes("8.8.8.8"));
  });
});

describe("fingerprints", () => {
  test("Engine.IO handshake", () => {
    assert.equal(
      isEngineIoHandshake('0{"sid":"abc","upgrades":["websocket"]}'),
      true,
    );
    assert.equal(isEngineIoHandshake('0{"upgrades":[]}'), false);
    assert.equal(isEngineIoHandshake("hello"), false);
  });

  test("RotorHazard HTML", () => {
    assert.equal(
      looksLikeRotorHazardHtml("<title>RotorHazard</title>"),
      true,
    );
    assert.equal(looksLikeRotorHazardHtml("<html>nginx</html>"), false);
  });
});

describe("ranking", () => {
  test("Next prefers LAN over localhost mock", () => {
    const ranked = rankNextCandidates([
      {
        url: "ws://127.0.0.1:9400",
        source: "localhost",
        label: "mock",
      },
      {
        url: "ws://192.168.1.50:5702",
        source: "scan",
        label: "lan",
      },
      {
        url: "ws://127.0.0.1:5702",
        source: "localhost",
        label: "local",
      },
    ]);
    assert.equal(ranked[0].url, "ws://192.168.1.50:5702");
    assert.equal(ranked[ranked.length - 1].source, "localhost");
  });

  test("RotorHazard prefers mDNS then :5000", () => {
    const ranked = rankRotorHazardCandidates([
      {
        url: "http://192.168.1.9:80",
        source: "scan",
        label: "a",
      },
      {
        url: "http://rotorhazard.local:5000",
        source: "mdns",
        label: "b",
      },
      {
        url: "http://192.168.1.9:5000",
        source: "scan",
        label: "c",
      },
    ]);
    assert.equal(ranked[0].source, "mdns");
    assert.equal(ranked[1].url, "http://192.168.1.9:5000");
  });

  test("compareIp orders numerically", () => {
    assert.ok(compareIp("192.168.1.2", "192.168.1.10") < 0);
  });
});

describe("live probes", () => {
  test("tcpOpen and Next WebSocket fingerprint", async () => {
    const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => wss.once("listening", resolve));
    const addr = wss.address();
    assert.ok(addr && typeof addr === "object");
    const { port } = addr;

    assert.equal(await tcpOpen("127.0.0.1", port), true);
    assert.equal(await tcpOpen("127.0.0.1", 1), false);
    assert.equal(await probeNextWebSocket("127.0.0.1", port), true);

    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  test("RotorHazard HTTP fingerprint via title", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><title>RotorHazard</title></html>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");

    assert.equal(await probeRotorHazardHttp("127.0.0.1", addr.port), true);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("RotorHazard Socket.io Engine.IO handshake", async () => {
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith("/socket.io/")) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end('0{"sid":"test-sid","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}');
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html>other</html>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");

    assert.equal(await probeRotorHazardHttp("127.0.0.1", addr.port), true);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
