import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Gate } from "@/lib/config/schema";
import { ALL_EXCEPT_START_LABEL, gatesExceptStart } from "@/lib/gate-targets";
import { describeStepTarget } from "@/lib/sequence-display";
import { sequenceStepSchema } from "@/lib/types";

function gate(id: string, isStartGate: boolean, enabled = true): Gate {
  return { id, host: `${id}.local`, isStartGate, enabled, sortOrder: 0 };
}

describe("gatesExceptStart", () => {
  test("drops the start gate and disabled gates", () => {
    const gates = gatesExceptStart([
      gate("gate-start", true),
      gate("gate-2", false),
      gate("gate-3", false, false),
    ]);
    assert.deepEqual(
      gates.map((g) => g.id),
      ["gate-2"],
    );
  });
});

describe("all except start target", () => {
  test("parses a step and describes it", () => {
    const step = sequenceStepSchema.parse({
      id: "s1",
      kind: "action",
      target: "all_except_start",
      action: { kind: "off" },
    });
    assert.equal(step.kind, "action");
    if (step.kind !== "action") return;
    assert.equal(
      describeStepTarget(step.target, step.targetGateId),
      ALL_EXCEPT_START_LABEL,
    );
  });
});
