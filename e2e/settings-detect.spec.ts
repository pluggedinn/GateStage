import { expect, test } from "@playwright/test";

test.describe("Settings race manager detect", () => {
  test("Detect finds mock Next WebSocket", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();

    const urlInput = page.getByLabel("WebSocket URL");
    await expect(urlInput).toBeVisible({ timeout: 15_000 });
    await urlInput.fill("ws://example.invalid:5702");

    await page.getByTestId("detect-race-manager").click();

    await expect(urlInput).toHaveValue(/ws:\/\/127\.0\.0\.1:(5702|9400)/, {
      timeout: 15_000,
    });
  });
});
