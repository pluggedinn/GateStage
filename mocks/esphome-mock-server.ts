/**
 * Mock ESPHome web_server REST API.
 *
 * - http://127.0.0.1:9080
 *   POST /light/:entity/turn_on?effect=...&color_mode=rgb&r=&g=&b=
 *   POST /light/:entity/turn_off
 *   POST /number/:entity/set?value=
 *   POST /switch/:entity/turn_on|turn_off
 *   GET  /light/:entity  current light JSON
 *   GET  /number/:entity current number JSON
 *   GET  /health
 *   GET  /state          command log (for tests)
 *   POST /reset          clear log
 */
import dgram from "node:dgram";
import http from "node:http";
import { URL } from "node:url";
import { mockGateTelemetry } from "../lib/dev/esphome-mock-fleet";

export type EsphomeCommandLog = {
  entity: string;
  action: "turn_on" | "turn_off" | "number_set" | "switch_on" | "switch_off";
  params: Record<string, string>;
  at: string;
};

export type EsphomeMockServer = {
  gateId: string;
  port: number;
  close: () => Promise<void>;
};

export function createEsphomeMockServer(options: {
  gateId: string;
  port: number;
}): EsphomeMockServer {
  const { gateId, port } = options;
  const logPrefix = `[mock-esphome:${gateId}]`;
  const commandLog: EsphomeCommandLog[] = [];
  const lightState = new Map<
    string,
    { on: boolean; params: Record<string, string> }
  >();
  const numberState = new Map<string, number>();
  const NUMBER_DEFAULTS: Record<string, number> = {
    "FX Strobe Period": 400,
    "FX Strobe On Time": 200,
    "FX Strobe Start Delay": 0,
  };
  const DEFAULT_LIGHT = {
    state: "ON",
    brightness: 153,
    effect: "Rainbow",
    color: { r: 255, g: 255, b: 255 },
  };

  function logCommand(
    entity: string,
    action: EsphomeCommandLog["action"],
    params: Record<string, string>,
  ) {
    const entry: EsphomeCommandLog = {
      entity,
      action,
      params,
      at: new Date().toISOString(),
    };
    commandLog.push(entry);
    if (action === "turn_on") {
      const prev = lightState.get(entity);
      lightState.set(entity, {
        on: true,
        params: { ...(prev?.params ?? {}), ...params },
      });
    } else if (action === "turn_off") {
      const prev = lightState.get(entity);
      lightState.set(entity, { on: false, params: prev?.params ?? {} });
    } else if (action === "number_set") {
      const value = Number(params.value);
      if (Number.isFinite(value)) numberState.set(entity, value);
    }
    console.log(
      `${logPrefix} ${action} ${entity}`,
      Object.keys(params).length ? params : "",
    );
  }

  const telemetry = mockGateTelemetry(gateId);
  const beaconPort = Number(process.env.GATESTAGE_BEACON_PORT ?? 9420);
  const beaconSock = dgram.createSocket("udp4");

  function sendBeacon() {
    const payload = JSON.stringify({
      v: 1,
      id: gateId,
      rssi: telemetry.rssi,
      tC: telemetry.tC,
      up: telemetry.up,
      dc: telemetry.dc,
      rssiMin: telemetry.rssiMin,
      port,
    });
    beaconSock.send(payload, beaconPort, "127.0.0.1", () => {});
  }

  const beaconTimer = setInterval(sendBeacon, 3_000);
  setTimeout(sendBeacon, 150);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const lightGet = url.pathname.match(/^\/light\/([^/]+)$/);
    if (req.method === "GET" && lightGet) {
      const entity = decodeURIComponent(lightGet[1]);
      const stored = lightState.get(entity);
      res.writeHead(200, { "Content-Type": "application/json" });
      if (!stored) {
        res.end(JSON.stringify({ id: entity, ...DEFAULT_LIGHT }));
        return;
      }
      const color: Record<string, number> = {};
      if (stored.params.r !== undefined) color.r = Number(stored.params.r);
      if (stored.params.g !== undefined) color.g = Number(stored.params.g);
      if (stored.params.b !== undefined) color.b = Number(stored.params.b);
      res.end(
        JSON.stringify({
          id: entity,
          state: stored.on ? "ON" : "OFF",
          brightness:
            stored.params.brightness !== undefined
              ? Number(stored.params.brightness)
              : DEFAULT_LIGHT.brightness,
          effect: stored.params.effect ?? "None",
          ...(Object.keys(color).length === 3 ? { color } : {}),
        }),
      );
      return;
    }

    const numberGet = url.pathname.match(/^\/number\/([^/]+)$/);
    if (req.method === "GET" && numberGet) {
      const entity = decodeURIComponent(numberGet[1]);
      const value = numberState.get(entity) ?? NUMBER_DEFAULTS[entity] ?? 0;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: entity,
          value,
          state: String(value),
        }),
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          commands: commandLog,
          lights: Object.fromEntries(lightState),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/reset") {
      commandLog.length = 0;
      lightState.clear();
      numberState.clear();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const numberMatch = url.pathname.match(/^\/number\/(.+)\/set$/);
    if (req.method === "POST" && numberMatch) {
      const entity = decodeURIComponent(numberMatch[1]);
      const params: Record<string, string> = {};
      for (const [k, v] of url.searchParams) {
        params[k] = v;
      }
      logCommand(entity, "number_set", params);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const switchMatch = url.pathname.match(
      /^\/switch\/(.+)\/(turn_on|turn_off)$/,
    );
    if (req.method === "POST" && switchMatch) {
      const entity = decodeURIComponent(switchMatch[1]);
      const action = switchMatch[2] === "turn_on" ? "switch_on" : "switch_off";
      logCommand(entity, action, {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const lightMatch = url.pathname.match(
      /^\/light\/(.+)\/(turn_on|turn_off)$/,
    );
    if (req.method === "POST" && lightMatch) {
      const entity = decodeURIComponent(lightMatch[1]);
      const action = lightMatch[2] as "turn_on" | "turn_off";
      const params: Record<string, string> = {};
      for (const [k, v] of url.searchParams) {
        params[k] = v;
      }
      logCommand(entity, action, params);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`${logPrefix} port ${port} already in use`);
    } else {
      console.error(`${logPrefix} server error:`, err);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`${logPrefix} http://127.0.0.1:${port}`);
  });

  return {
    gateId,
    port,
    close: () =>
      new Promise((resolve, reject) => {
        clearInterval(beaconTimer);
        beaconSock.close();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

const isDirectRun = process.argv[1]?.includes("esphome-mock-server");

if (isDirectRun) {
  const port = Number(process.env.ESPHOME_MOCK_PORT ?? 9080);
  const gateId = process.env.ESPHOME_MOCK_GATE_ID ?? "gate-mock";
  const mock = createEsphomeMockServer({ gateId, port });

  const shutdown = () => {
    void mock.close().finally(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
