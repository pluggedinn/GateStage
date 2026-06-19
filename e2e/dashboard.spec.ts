import { expect, test } from "@playwright/test";
import { emitNextEvent } from "./helpers/mocks";

test.describe("Dashboard", () => {
  test("shows race event after mock Next emit", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Socket.io connected")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Next connected")).toBeVisible({
      timeout: 15_000,
    });

    await emitNextEvent("heat.go");

    await expect(page.getByText("heat.go")).toBeVisible({ timeout: 10_000 });
  });
});
