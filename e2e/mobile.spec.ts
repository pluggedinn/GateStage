import { expect, type Locator, type Page, test } from "@playwright/test";
import { resetEsphome } from "./helpers/mocks";

const routes = ["/", "/gates", "/routines", "/manual", "/settings", "/logs"];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectFullyAcross(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test.describe("iPhone 14 Pro", () => {
  test("uses the phone viewport", async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 393, height: 660 });
  });

  test("header fits and the menu reaches every page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("desktop-nav")).toBeHidden();
    await expect(page.getByTestId("mobile-nav")).toBeHidden();

    const menuButton = page.getByTestId("mobile-menu-button");
    await expectFullyAcross(menuButton);
    await expect(
      page.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await menuButton.click();
    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expectFullyAcross(
      mobileNav.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    );
    await expectNoHorizontalOverflow(page);

    for (const label of [
      "Dashboard",
      "Gates",
      "Routines",
      "Manual",
      "Settings",
      "Logs",
    ]) {
      await expectFullyAcross(mobileNav.getByRole("link", { name: label }));
    }

    await mobileNav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(mobileNav).toBeHidden();
  });

  test("pages do not scroll sideways", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("routine actions stay on screen", async ({ page }) => {
    await page.goto("/routines");
    const addButtons = page.getByRole("button", { name: "Add step" });
    await expect(addButtons.first()).toBeVisible();
    const count = await addButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expectFullyAcross(addButtons.nth(i));
    }
  });

  test("gate test and forget sit on the mobile list", async ({ page }) => {
    await resetEsphome();
    const discoverRes = await page.request.post("/api/gates/discover");
    expect(discoverRes.ok()).toBeTruthy();

    await page.goto("/gates");
    const list = page.getByTestId("gates-mobile-list");
    await expect(list).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();

    const card = page.getByTestId("gate-mobile-gate-start");
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expectFullyAcross(page.getByTestId("gate-test-mobile-gate-start"));
    await expectFullyAcross(page.getByTestId("gate-forget-mobile-gate-start"));
    await expectNoHorizontalOverflow(page);
  });

  test("log filters and settings actions stay on screen", async ({ page }) => {
    await page.goto("/logs");
    for (const label of ["All", "Info+", "Warn+", "Error"]) {
      await expectFullyAcross(page.getByRole("button", { name: label }));
    }
    await expectNoHorizontalOverflow(page);

    await page.goto("/settings");
    await expectFullyAcross(page.getByTestId("detect-race-manager"));
    await expectFullyAcross(
      page.getByRole("button", { name: "Save", exact: true }),
    );
    await expectFullyAcross(
      page.getByRole("button", { name: "Save as race default" }),
    );
    await expectNoHorizontalOverflow(page);
  });
});
