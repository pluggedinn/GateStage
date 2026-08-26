import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { translateNextMessage } from "./next-events";

describe("translateNextMessage", () => {
  test("arm → heat.arm_started", () => {
    assert.deepEqual(
      translateNextMessage({ event: "arm", eventId: 133, heat: 3 }),
      {
        type: "heat.arm_started",
        heat: { id: "3", name: "Heat 3" },
      },
    );
  });

  test("start → heat.go", () => {
    assert.deepEqual(
      translateNextMessage({ event: "start", eventId: 133, heat: 3 }),
      {
        type: "heat.go",
        heat: { id: "3", name: "Heat 3" },
      },
    );
  });

  test("finish → heat.finished", () => {
    assert.deepEqual(
      translateNextMessage({ event: "finish", eventId: 133, heat: 3 }),
      {
        type: "heat.finished",
        heat: { id: "3", name: "Heat 3" },
      },
    );
  });

  test("lastcall → heat.last_call", () => {
    assert.deepEqual(
      translateNextMessage({ event: "lastcall", eventId: 133, seconds: 60 }),
      {
        type: "heat.last_call",
        seconds: 60,
        heat: { id: "133" },
      },
    );
  });

  test("pilot → pilot.crossing with hex color", () => {
    assert.deepEqual(
      translateNextMessage({
        event: "pilot",
        eventId: 133,
        pilotId: 42,
        pilot: "John Doe",
        color: "FF0000",
        lap: 1,
      }),
      {
        type: "pilot.crossing",
        pilot: {
          id: "42",
          name: "John Doe",
          color: { r: 255, g: 0, b: 0 },
        },
        crossing: { lap: 1 },
        heat: { id: "133" },
      },
    );
  });

  test("accepts an already-normalized heat.go", () => {
    const internal = {
      type: "heat.go" as const,
      heat: { id: "heat-1", name: "Round 1 · Heat 3" },
    };
    assert.deepEqual(translateNextMessage(internal), internal);
  });

  test("ignores junk payloads", () => {
    assert.equal(translateNextMessage(null), null);
    assert.equal(translateNextMessage({ event: "unknown" }), null);
    assert.equal(translateNextMessage({ foo: "bar" }), null);
  });
});
