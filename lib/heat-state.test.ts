import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { resolveActionColor } from "./color-source";
import {
  ingestRaceEvent,
  resetHeatState,
  resolveWinnerColor,
  WINNER_MIN_LAPS,
} from "./heat-state";
import { testHeat, testPilots } from "./test-race-event";
import type { RaceEvent } from "./types";

const alpha = testPilots[0];
const bravo = testPilots[1];

function crossing(pilot: (typeof testPilots)[number], lap: number): RaceEvent {
  return {
    type: "pilot.crossing",
    pilot,
    crossing: { lap },
    heat: testHeat,
  };
}

beforeEach(() => {
  resetHeatState();
});

describe("winner color", () => {
  test("first crossing at WINNER_MIN_LAPS becomes the winner", () => {
    ingestRaceEvent(crossing(alpha, 1));
    ingestRaceEvent(crossing(alpha, 2));
    assert.equal(resolveWinnerColor(), null);

    ingestRaceEvent(crossing(alpha, WINNER_MIN_LAPS));
    assert.deepEqual(resolveWinnerColor(), alpha.color);
  });

  test("later 3-lap crossings do not steal the winner", () => {
    ingestRaceEvent(crossing(bravo, WINNER_MIN_LAPS));
    ingestRaceEvent(crossing(alpha, WINNER_MIN_LAPS));
    assert.deepEqual(resolveWinnerColor(), bravo.color);
  });

  test("a first sighting already at 3 laps still wins", () => {
    ingestRaceEvent(crossing(alpha, 4));
    assert.deepEqual(resolveWinnerColor(), alpha.color);
  });

  test("heat.go and heat.arm_started clear the winner", () => {
    ingestRaceEvent(crossing(alpha, WINNER_MIN_LAPS));
    ingestRaceEvent({ type: "heat.go", heat: testHeat });
    assert.equal(resolveWinnerColor(), null);

    ingestRaceEvent(crossing(bravo, WINNER_MIN_LAPS));
    ingestRaceEvent({ type: "heat.arm_started", heat: testHeat });
    assert.equal(resolveWinnerColor(), null);
  });

  test("heat.loaded clears the winner", () => {
    ingestRaceEvent(crossing(alpha, WINNER_MIN_LAPS));
    ingestRaceEvent({
      type: "heat.loaded",
      heat: testHeat,
      pilots: [...testPilots],
    });
    assert.equal(resolveWinnerColor(), null);
  });

  test("resolveActionColor uses the stored winner on heat.finished", () => {
    ingestRaceEvent(crossing(bravo, 1));
    ingestRaceEvent(crossing(alpha, WINNER_MIN_LAPS));
    ingestRaceEvent(crossing(bravo, WINNER_MIN_LAPS));

    const rgb = resolveActionColor(
      { colorSource: "winner" },
      { type: "heat.finished", heat: testHeat },
    );
    assert.deepEqual(rgb, alpha.color);
  });

  test("resolveActionColor is null when nobody has finished 3 laps", () => {
    ingestRaceEvent(crossing(alpha, 2));
    const rgb = resolveActionColor(
      { colorSource: "winner" },
      { type: "heat.finished", heat: testHeat },
    );
    assert.equal(rgb, null);
  });
});
