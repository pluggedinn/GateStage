/**
 * Mock Next race director WebSocket server.
 *
 * Emits the documented Next wire format (arm / start / finish / lastcall / pilot).
 *
 * - WebSocket: ws://127.0.0.1:9400 (race events)
 * - HTTP control: http://127.0.0.1:9401
 *   POST /emit     { "type": "heat.go" }  or a Next envelope { "event": "start", ... }
 *   POST /sequence { "speed": 1 }        run full heat with optional speed multiplier
 *   GET  /health
 */
import http from "node:http";
import { WebSocketServer } from "ws";
import {
  type NextWireEvent,
  nextWireEventSchema,
} from "@/lib/adapters/next-events";
import { heatSequence, nextWireFixtures } from "./fixtures/race-events";

const WS_PORT = Number(process.env.NEXT_MOCK_WS_PORT ?? 9400);
const HTTP_PORT = Number(process.env.NEXT_MOCK_HTTP_PORT ?? 9401);

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set<import("ws").WebSocket>();

function broadcast(event: NextWireEvent) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
  console.log(
    `[mock-next] broadcast ${event.event} to ${clients.size} client(s)`,
  );
}

function resolveEmitPayload(parsed: unknown): NextWireEvent | null {
  const direct = nextWireEventSchema.safeParse(parsed);
  if (direct.success) return direct.data;

  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as { event?: unknown; type?: unknown };

  const nested = nextWireEventSchema.safeParse(body.event);
  if (nested.success) return nested.data;

  if (typeof body.type === "string") {
    return nextWireFixtures[body.type] ?? null;
  }

  return null;
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[mock-next] client connected (${clients.size} total)`);
  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[mock-next] client disconnected (${clients.size} total)`);
  });
});

async function runSequence(speed = 1) {
  for (const step of heatSequence) {
    if (step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs / speed));
    }
    broadcast(step.event);
  }
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${HTTP_PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: clients.size }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/emit") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const event = resolveEmitPayload(JSON.parse(body));
      if (!event) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Provide a Next event envelope or known type",
          }),
        );
        return;
      }
      broadcast(event);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, event: event.event }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/sequence") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const speed = body
      ? ((JSON.parse(body) as { speed?: number }).speed ?? 10)
      : 10;
    void runSequence(speed);
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "sequence started" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[mock-next] WebSocket ws://127.0.0.1:${WS_PORT}`);
  console.log(`[mock-next] HTTP control http://127.0.0.1:${HTTP_PORT}`);
});

process.on("SIGINT", () => {
  wss.close();
  httpServer.close();
  process.exit(0);
});
