import { expect, test } from "@playwright/test";
import {
  getEsphomeState,
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

test.describe("Routine play button", () => {
  test.beforeEach(async () => {
    await resetEsphome();
    await fetch(`${API}/api/gates/discover`, { method: "POST" });
    await resetRoutineSteps("heat.go");
  });

  test("play button runs heat.go routine and stops spinning when done", async ({
    page,
  }) => {
    const stepRes = await fetch(`${API}/api/sequences/heat.go/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "solid",
          colorSource: "fixed",
          r: 0,
          g: 255,
          b: 0,
          brightnessPercent: 5,
        },
      }),
    });
    expect(stepRes.ok).toBeTruthy();

    // Short delay so the button stays in the spinning state long enough to assert.
    const delayRes = await fetch(`${API}/api/sequences/heat.go/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "delay",
        ms: 400,
      }),
    });
    expect(delayRes.ok).toBeTruthy();

    await page.goto("/routines");

    const play = page.getByTestId("run-routine-heat.go");
    await expect(play).toBeEnabled();

    await play.click();
    await expect(play.locator("svg")).toHaveClass(/animate-spin/);

    await waitForEsphomeCommands(1);
    const state = await getEsphomeState();
    const turnOn = state.commands.filter((c) => c.action === "turn_on");
    expect(turnOn.some((c) => c.params.g === "255")).toBe(true);

    await expect(play.locator("svg")).not.toHaveClass(/animate-spin/, {
      timeout: 10_000,
    });
    await expect(play).toBeEnabled();
  });

  test("play button is disabled when routine has no steps", async ({
    page,
  }) => {
    await page.goto("/routines");
    const play = page.getByTestId("run-routine-heat.go");
    await expect(play).toBeDisabled();
  });
});
