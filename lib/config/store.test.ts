import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  forgetGate,
  getGates,
  mergeDiscoveredGates,
  rememberStartGateId,
  resetDiscoveryMemory,
} from "./store";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatestage-store-"));
  process.env.GATESTAGE_CONFIG_PATH = path.join(tmpDir, "config.json");
  resetDiscoveryMemory();
});

afterEach(() => {
  resetDiscoveryMemory();
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("mergeDiscoveredGates", () => {
  test("does not delete a gate missing from a later sighting", () => {
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);

    const result = mergeDiscoveredGates([
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);

    assert.deepEqual(result.gates.map((g) => g.id).sort(), [
      "gate-2",
      "gate-start",
    ]);
    assert.equal(result.removed.length, 0);
    assert.equal(
      getGates().find((g) => g.id === "gate-start")?.isStartGate,
      true,
    );
  });

  test("keeps start on the original gate when it is unseen", () => {
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);
    rememberStartGateId("gate-start");
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);

    mergeDiscoveredGates([
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);

    const gates = getGates();
    assert.equal(gates.find((g) => g.id === "gate-start")?.isStartGate, true);
    assert.equal(gates.find((g) => g.id === "gate-2")?.isStartGate, false);
  });

  test("first ever gate becomes start", () => {
    const result = mergeDiscoveredGates([
      { id: "gate-3", host: "10.0.0.3:80", source: "udp" },
    ]);
    assert.equal(result.gates[0]?.id, "gate-3");
    assert.equal(result.gates[0]?.isStartGate, true);
  });

  test("second gate does not steal start", () => {
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
    ]);
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);
    const gates = getGates();
    assert.equal(gates.find((g) => g.id === "gate-start")?.isStartGate, true);
    assert.equal(gates.find((g) => g.id === "gate-2")?.isStartGate, false);
  });

  test("updates host without changing start", () => {
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
    ]);
    const result = mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.9:80", source: "udp" },
    ]);
    assert.deepEqual(result.updated, ["gate-start"]);
    assert.equal(getGates()[0]?.host, "10.0.0.9:80");
    assert.equal(getGates()[0]?.isStartGate, true);
  });
});

describe("forgetGate", () => {
  test("promotes the next sortOrder gate to start", () => {
    mergeDiscoveredGates([
      { id: "gate-start", host: "10.0.0.1:80", source: "udp" },
      { id: "gate-2", host: "10.0.0.2:80", source: "udp" },
    ]);
    const remaining = forgetGate("gate-start");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.id, "gate-2");
    assert.equal(remaining[0]?.isStartGate, true);
  });
});
