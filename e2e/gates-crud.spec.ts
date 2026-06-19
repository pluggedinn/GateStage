import { expect, test } from "@playwright/test";
import { getEsphomeState, resetEsphome } from "./helpers/mocks";

test.describe("Gates CRUD", () => {
  test.beforeEach(async () => {
    await resetEsphome();
  });

  test("add gate and test sends Rainbow to mock ESPHome", async ({ page }) => {
    await page.goto("/gates");
    await expect(page.getByRole("heading", { name: "Gates" })).toBeVisible();

    await page.getByLabel("ID").fill("e2e-test-gate");
    await page.getByLabel("Host").fill("127.0.0.1:9080");

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/gates") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add manually" }).click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    await expect(page.getByRole("cell", { name: "e2e-test-gate" })).toBeVisible({
      timeout: 10_000,
    });

    const row = page.getByRole("row", { name: /e2e-test-gate/ });
    await row.getByRole("button", { name: "Test" }).click();

    await expect
      .poll(async () => {
        const state = await getEsphomeState();
        return state.commands.some(
          (c) =>
            c.action === "turn_on" && c.params.effect === "Rainbow",
        );
      })
      .toBe(true);
  });
});
