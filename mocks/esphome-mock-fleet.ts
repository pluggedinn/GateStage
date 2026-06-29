/**
 * Six mock ESPHome servers in one process (ports 9080–9085).
 * Single-process fleet avoids orphaned children blocking ports on restart.
 */
import { execSync } from "node:child_process";
import { ESPHOME_MOCK_FLEET } from "../lib/dev/esphome-mock-fleet";
import { createEsphomeMockServer } from "./esphome-mock-server";

function freeFleetPorts() {
  for (const { port } of ESPHOME_MOCK_FLEET) {
    try {
      execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
        stdio: "ignore",
        shell: "/bin/bash",
      });
    } catch {
      // No listener on this port.
    }
  }
}

freeFleetPorts();

const servers = ESPHOME_MOCK_FLEET.map((gate) =>
  createEsphomeMockServer({ gateId: gate.id, port: gate.port }),
);

console.log(
  `[mock-esphome-fleet] ${ESPHOME_MOCK_FLEET.length} gates:`,
  ESPHOME_MOCK_FLEET.map((g) => `${g.id}@127.0.0.1:${g.port}`).join(", "),
);

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled(servers.map((s) => s.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
