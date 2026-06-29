import { expect, test } from "@playwright/test";
import { getEsphomeState, resetEsphome } from "./helpers/mocks";

test.describe("Gates discovery", () => {
  test.beforeEach(async () => {
    await resetEsphome();
  });

  test("scan discovers mock gate and test sends Rainbow", async ({ page }) => {
    const discoverRes = await page.request.post("/api/gates/discover");
    expect(discoverRes.ok()).toBeTruthy();

    await page.goto("/gates");
    await expect(page.getByRole("heading", { name: "Gates" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "gate-start" })).toBeVisible({
      timeout: 10_000,
    });

    const row = page.getByRole("row", { name: /gate-start/ });
    await row.getByRole("button", { name: "Test" }).click();

    await expect
      .poll(async () => {
        const state = await getEsphomeState();
        return state.commands.some(
          (c) => c.action === "turn_on" && c.params.effect === "Rainbow",
        );
      })
      .toBe(true);
  });
});
