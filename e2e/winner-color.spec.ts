import { expect, test } from "@playwright/test";
import {
  emitNextEvent,
  emitNextWire,
  resetEsphome,
  waitForEsphomeCommands,
} from "./helpers/mocks";

const API = "http://127.0.0.1:8080";

async function resetRoutineSteps(eventType: string) {
  const res = await fetch(`${API}/api/sequences`);
  const sequences = (await res.json()) as {
    eventType: string;
    steps: { id: string }[];
  }[];
  const sequence = sequences.find((s) => s.eventType === eventType);
  if (!sequence) return;

  for (const step of sequence.steps) {
    await fetch(
      `${API}/api/sequences/${encodeURIComponent(eventType)}/steps/${encodeURIComponent(step.id)}`,
      { method: "DELETE" },
    );
  }
}

function pilotWire(pilotId: number, name: string, color: string, lap: number) {
  return {
    event: "pilot",
    eventId: 133,
    pilotId,
    pilot: name,
    color,
    lap,
  };
}

test.describe("Winner color", () => {
  test.beforeEach(async () => {
    await resetEsphome();
    await fetch(`${API}/api/gates/discover`, { method: "POST" });
    await resetRoutineSteps("heat.go");
    await resetRoutineSteps("heat.finished");
  });

  test("heat.finished uses the first 3-lap pilot color", async ({ page }) => {
    const stepRes = await fetch(`${API}/api/sequences/heat.finished/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "solid",
          colorSource: "winner",
          brightnessPercent: 5,
        },
      }),
    });
    expect(stepRes.ok).toBeTruthy();

    await page.goto("/");
    await expect(page.getByTestId("connection-status")).toBeVisible({
      timeout: 15_000,
    });

    await emitNextEvent("heat.go");
    await expect(page.getByTestId("last-event-type")).toHaveText("heat.go", {
      timeout: 10_000,
    });

    await emitNextWire(pilotWire(1, "Alpha", "FF0000", 1));
    await emitNextWire(pilotWire(1, "Alpha", "FF0000", 2));
    await emitNextWire(pilotWire(1, "Alpha", "FF0000", 3));
    await emitNextWire(pilotWire(2, "Bravo", "0080FF", 3));

    await expect(page.getByTestId("last-event-type")).toHaveText(
      "pilot.crossing",
      { timeout: 10_000 },
    );

    await emitNextEvent("heat.finished");

    const state = await waitForEsphomeCommands(1);
    const turnOn = state.commands.filter((c) => c.action === "turn_on");
    expect(turnOn.length).toBeGreaterThan(0);
    expect(turnOn.some((c) => c.params.r === "255" && c.params.g === "0")).toBe(
      true,
    );
    expect(turnOn.some((c) => c.params.b === "255")).toBe(false);
  });
});
