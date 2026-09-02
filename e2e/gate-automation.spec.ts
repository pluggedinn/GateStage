import { expect, test } from "@playwright/test";
import {
  emitNextEvent,
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

test.describe("Gate automation", () => {
  test.beforeEach(async () => {
    await resetEsphome();
    await fetch(`${API}/api/gates/discover`, { method: "POST" });
    await resetRoutineSteps("heat.go");
  });

  test("heat.go triggers green RGB on mock ESPHome gates", async ({ page }) => {
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

    await page.goto("/");
    const connections = page.getByTestId("connection-status");
    await expect(connections).toBeVisible({ timeout: 15_000 });
    await expect(connections.getByText("Socket")).toBeVisible();
    await expect(connections.getByText("Next")).toBeVisible();

    await emitNextEvent("heat.go");

    const state = await waitForEsphomeCommands(1);
    const turnOn = state.commands.filter((c) => c.action === "turn_on");
    expect(turnOn.length).toBeGreaterThan(0);
    expect(turnOn.some((c) => c.params.g === "255")).toBe(true);

    await expect(page.getByTestId("last-event-type")).toHaveText("heat.go", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("latest-event-type")).toHaveText("heat.go");
  });
});
