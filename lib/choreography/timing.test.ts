import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  computeTunnelSchedule,
  DEFAULT_STAGGER_MS,
  MIN_STAGGER_MS,
  resolveTunnelStaggerMs,
  TUNNEL_LEAD_MS,
} from "./timing";

describe("resolveTunnelStaggerMs", () => {
  test("prefers staggerMs over durationMs", () => {
    assert.equal(
      resolveTunnelStaggerMs({
        staggerMs: 50,
        durationMs: 3000,
        gateCount: 6,
      }),
      50,
    );
  });

  test("migrates durationMs to stagger when stagger is missing", () => {
    assert.equal(resolveTunnelStaggerMs({ durationMs: 480, gateCount: 6 }), 80);
  });

  test("clamps below the minimum stagger", () => {
    assert.equal(
      resolveTunnelStaggerMs({ staggerMs: 5, gateCount: 4 }),
      MIN_STAGGER_MS,
    );
  });

  test("falls back to the default stagger", () => {
    assert.equal(resolveTunnelStaggerMs({ gateCount: 4 }), DEFAULT_STAGGER_MS);
  });
});

describe("computeTunnelSchedule", () => {
  test("spaces start delays by stagger after the lead", () => {
    const schedule = computeTunnelSchedule({
      gateCount: 3,
      staggerMs: 80,
    });
    assert.equal(schedule.periodMs, 240);
    assert.equal(schedule.onMs, 80);
    assert.deepEqual(schedule.startDelaysMs, [
      TUNNEL_LEAD_MS,
      TUNNEL_LEAD_MS + 80,
      TUNNEL_LEAD_MS + 160,
    ]);
  });

  test("subtracts rtt/2 and clamps at zero", () => {
    const schedule = computeTunnelSchedule({
      gateCount: 2,
      staggerMs: 80,
      leadMs: 100,
      rttMs: [300, 40],
    });
    assert.deepEqual(schedule.startDelaysMs, [0, 160]);
  });

  test("uses onMs when provided", () => {
    const schedule = computeTunnelSchedule({
      gateCount: 4,
      staggerMs: 80,
      onMs: 40,
    });
    assert.equal(schedule.onMs, 40);
    assert.equal(schedule.periodMs, 320);
  });
});
