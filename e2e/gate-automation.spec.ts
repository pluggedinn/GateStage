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
