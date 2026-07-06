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

    await expect(
      page.getByRole("cell", { name: "gate-start", exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });

    const testRes = await page.request.post("/api/gates/gate-start", {
      data: { action: "test" },
    });
    expect(testRes.ok()).toBeTruthy();

    await expect
      .poll(async () => {
        const state = await getEsphomeState();
        return state.commands.some(
          (c) => c.action === "turn_on" && c.params.effect === "Rainbow",
        );
      })
      .toBe(true);
  });

  test("reorder gates via API persists sort order", async ({ page }) => {
    const discoverRes = await page.request.post("/api/gates/discover");
    expect(discoverRes.ok()).toBeTruthy();

    const beforeRes = await page.request.get("/api/gates");
    expect(beforeRes.ok()).toBeTruthy();
    const gates = (await beforeRes.json()) as { id: string }[];
    expect(gates.length).toBeGreaterThanOrEqual(2);

    const reversed = [...gates].reverse().map((g) => g.id);
    const reorderRes = await page.request.post("/api/gates/reorder", {
      data: { orderedIds: reversed },
    });
    expect(reorderRes.ok()).toBeTruthy();

    const afterRes = await page.request.get("/api/gates");
    const reordered = (await afterRes.json()) as { id: string }[];
    expect(reordered.map((g) => g.id)).toEqual(reversed);
  });

  test("network discovery preserves user-defined gate order", async ({
    page,
  }) => {
    await page.request.post("/api/gates/discover");
    const gatesRes = await page.request.get("/api/gates");
    const gates = (await gatesRes.json()) as { id: string }[];
    expect(gates.length).toBeGreaterThanOrEqual(2);

    const swapped = [...gates].reverse().map((g) => g.id);
    await page.request.post("/api/gates/reorder", {
      data: { orderedIds: swapped },
    });

    await page.request.post("/api/gates/discover");
    const afterDiscoverRes = await page.request.get("/api/gates");
    const afterDiscover = (await afterDiscoverRes.json()) as { id: string }[];
    expect(afterDiscover.map((g) => g.id)).toEqual(swapped);
  });
});
