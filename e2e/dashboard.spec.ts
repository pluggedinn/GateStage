import { expect, test } from "@playwright/test";
import { emitNextEvent } from "./helpers/mocks";

test.describe("Dashboard", () => {
  test("shows race event after mock Next emit", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const connections = page.getByTestId("connection-status");
    await expect(connections).toBeVisible({ timeout: 15_000 });
    await expect(connections.getByText("Socket")).toBeVisible();
    await expect(connections.getByText("Next")).toBeVisible();

    await emitNextEvent("heat.go");

    await expect(page.getByTestId("last-event-type")).toHaveText("heat.go", {
      timeout: 10_000,
    });
  });
});
