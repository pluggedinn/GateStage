import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mappingActionSchema } from "./types";

describe("mappingActionSchema fadeMs", () => {
  test("accepts fadeMs and actions without it", () => {
    const faded = mappingActionSchema.parse({
      kind: "solid",
      r: 255,
      g: 0,
      b: 0,
      fadeMs: 500,
    });
    assert.equal(faded.kind, "solid");
    if (faded.kind === "solid") assert.equal(faded.fadeMs, 500);

    const effect = mappingActionSchema.parse({
      kind: "effect",
      effectId: "addressable_rainbow",
      fadeMs: 250,
    });
    assert.equal(effect.kind, "effect");
    if (effect.kind === "effect") assert.equal(effect.fadeMs, 250);

    const plain = mappingActionSchema.parse({ kind: "off" });
    assert.equal(plain.kind, "off");
    if (plain.kind === "off") assert.equal(plain.fadeMs, undefined);

    const pilot = mappingActionSchema.parse({ kind: "pilot_color" });
    assert.equal(pilot.kind, "pilot_color");
    if (pilot.kind === "pilot_color") assert.equal(pilot.fadeMs, undefined);
  });
});
