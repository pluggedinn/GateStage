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

const PORT = Number(process.env.ESPHOME_MOCK_PORT ?? 9080);

export type EsphomeCommandLog = {
  entity: string;
  action: "turn_on" | "turn_off" | "number_set" | "switch_on" | "switch_off";
  params: Record<string, string>;
  at: string;
};

const commandLog: EsphomeCommandLog[] = [];
const lightState = new Map<string, { on: boolean; params: Record<string, string> }>();

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
    `[mock-esphome] ${action} ${entity}`,
    Object.keys(params).length ? params : "",
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

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

server.listen(PORT, () => {
  console.log(`[mock-esphome] http://127.0.0.1:${PORT}`);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
