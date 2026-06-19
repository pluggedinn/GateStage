import { expect, test } from "@playwright/test";
import {
  emitNextEvent,
  resetEsphome,
  waitForEsphomeCommands,
} from "./helpers/mocks";

test.describe("Gate automation", () => {
  test.beforeEach(async () => {
    await resetEsphome();
    await fetch("http://127.0.0.1:8080/api/gates/discover", { method: "POST" });
  });

  test("heat.go triggers green RGB on mock ESPHome gates", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Socket.io connected")).toBeVisible({
      timeout: 15_000,
    });

    await emitNextEvent("heat.go");

    const state = await waitForEsphomeCommands(1);
    const turnOn = state.commands.filter((c) => c.action === "turn_on");
    expect(turnOn.length).toBeGreaterThan(0);
    expect(turnOn.some((c) => c.params.g === "255")).toBe(true);

    await expect(page.getByText("heat.go")).toBeVisible({ timeout: 10_000 });
  });
});
