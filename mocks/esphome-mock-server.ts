/**
 * Mock ESPHome web_server REST API.
 *
 * - http://127.0.0.1:9080
 *   POST /light/:entity/turn_on?effect=...&color_mode=rgb&r=&g=&b=
 *   POST /light/:entity/turn_off
 *   POST /number/:entity/set?value=
 *   POST /switch/:entity/turn_on|turn_off
 *   GET  /health
 *   GET  /state          command log (for tests)
 *   POST /reset          clear log
 */
import http from "node:http";
import { URL } from "node:url";

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
    if (action === "turn_on" || action === "turn_off") {
      lightState.set(entity, { on: action === "turn_on", params });
    }
    console.log(
      `${logPrefix} ${action} ${entity}`,
      Object.keys(params).length ? params : "",
    );
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
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

    const switchMatch = url.pathname.match(/^\/switch\/(.+)\/(turn_on|turn_off)$/);
    if (req.method === "POST" && switchMatch) {
      const entity = decodeURIComponent(switchMatch[1]);
      const action = switchMatch[2] === "turn_on" ? "switch_on" : "switch_off";
      logCommand(entity, action, {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const lightMatch = url.pathname.match(/^\/light\/(.+)\/(turn_on|turn_off)$/);
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
