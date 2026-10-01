import { expect, type Page, test } from "@playwright/test";
import { getEsphomeStateForGate, resetEsphome } from "./helpers/mocks";

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

function routineCard(page: Page, eventType: string) {
  return page.locator("[data-slot='card']").filter({
    has: page.getByText(eventType, { exact: true }),
  });
}

test.describe("Buttons and dropdowns", () => {
  test("nav links open each page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");

    await nav.getByRole("link", { name: "Gates" }).click();
    await expect(page.getByRole("heading", { name: "Gates" })).toBeVisible();

    await nav.getByRole("link", { name: "Routines" }).click();
    await expect(page.getByRole("heading", { name: "Routines" })).toBeVisible();

    await nav.getByRole("link", { name: "Manual" }).click();
    await expect(
      page.getByRole("heading", { name: "Manual control" }),
    ).toBeVisible();

    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await nav.getByRole("link", { name: "Logs" }).click();
    await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible();

    await nav.getByRole("link", { name: "Dashboard" }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("theme toggle switches mode", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", {
      name: /Switch to (dark|light) mode/,
    });
    await expect(toggle).toBeEnabled();
    const toDark = (await toggle.getAttribute("aria-label"))?.includes("dark");

    await toggle.click();

    await expect(
      page.getByRole("button", {
        name: toDark ? "Switch to light mode" : "Switch to dark mode",
      }),
    ).toBeVisible();
    if (toDark) {
      await expect(page.locator("html")).toHaveClass(/dark/);
    } else {
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    }
  });

  test("provider dropdown changes the connection fields and Save persists", async ({
    page,
  }) => {
    const originalRes = await page.request.get("/api/settings");
    expect(originalRes.ok()).toBeTruthy();
    const original = (await originalRes.json()) as {
      raceManagerProvider: string;
      nextWsUrl: string;
      rotorHazardUrl: string;
    };

    try {
      await page.goto("/settings");
      const provider = page.getByLabel("Provider");
      await expect(provider).toBeEnabled({ timeout: 15_000 });

      await provider.click();
      await page.getByRole("option", { name: /RotorHazard/ }).click();
      await expect(page.getByLabel("Server URL")).toBeVisible();
      await expect(page.getByText(/RotorHazard lap timer/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

      await provider.click();
      await expect(
        page.getByRole("option", { name: /FPV Trackside/ }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");

      await provider.click();
      await page.getByRole("option", { name: /^Next/ }).click();
      const url = page.getByLabel("WebSocket URL");
      await expect(url).toBeVisible();
      await url.fill("ws://127.0.0.1:9400");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(
        page.getByText("Race manager connection saved"),
      ).toBeVisible();

      await page.reload();
      await expect(provider).toBeEnabled({ timeout: 15_000 });
      await expect(page.getByLabel("WebSocket URL")).toHaveValue(
        "ws://127.0.0.1:9400",
      );
    } finally {
      await page.request.patch("/api/settings", {
        data: {
          raceManagerProvider: original.raceManagerProvider,
          nextWsUrl: original.nextWsUrl,
          rotorHazardUrl: original.rotorHazardUrl,
        },
      });
    }
  });

  test("Save as race default persists the brightness slider", async ({
    page,
  }) => {
    const originalRes = await page.request.get("/api/settings");
    const original = (await originalRes.json()) as {
      defaultBrightnessPercent: number;
    };

    try {
      await page.goto("/settings");
      const save = page.getByRole("button", { name: "Save as race default" });
      await expect(save).toBeEnabled({ timeout: 15_000 });

      const slider = page.getByLabel("Brightness");
      await slider.fill("12");
      await expect(page.getByText("12% (31/255)")).toBeVisible();
      await save.click();
      await expect(page.getByText("Default brightness saved")).toBeVisible();

      await page.reload();
      await expect(save).toBeEnabled({ timeout: 15_000 });
      await expect(page.getByLabel("Brightness")).toHaveValue("12");
    } finally {
      await page.request.patch("/api/settings", {
        data: { defaultBrightnessPercent: original.defaultBrightnessPercent },
      });
    }
  });

  test("manual gate, behavior, and effect controls send a command", async ({
    page,
  }) => {
    await resetEsphome();
    const discoverRes = await page.request.post("/api/gates/discover");
    expect(discoverRes.ok()).toBeTruthy();

    await page.goto("/manual");
    await expect(
      page.getByRole("heading", { name: "Manual control" }),
    ).toBeVisible();

    const gates = page.getByRole("radiogroup", { name: "Select gate" });
    await gates.getByRole("radio", { name: "All gates" }).click();
    await expect(gates.getByRole("radio", { name: "All gates" })).toBeChecked();

    const behavior = page.getByRole("radiogroup", { name: "LED behavior" });
    await behavior.getByRole("radio", { name: "Off" }).click();
    await expect(
      page.getByRole("button", { name: "Turn off gates" }),
    ).toBeEnabled();

    await gates.getByRole("radio", { name: /gate-2/ }).click();
    await expect(gates.getByRole("radio", { name: /gate-2/ })).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Turn off gate" }),
    ).toBeEnabled();

    await behavior.getByRole("radio", { name: "Solid" }).click();
    await expect(
      page.getByRole("button", { name: "Apply color" }),
    ).toBeEnabled();

    await behavior.getByRole("radio", { name: "Effect" }).click();
    const effect = page.getByRole("combobox");
    await expect(effect).toContainText("Rainbow");
    await effect.click();
    await page.getByRole("option", { name: /Strobe/ }).click();
    await expect(effect).toContainText("Strobe");

    await page.getByRole("button", { name: "Apply effect" }).click();
    await expect(page.getByText("Command sent")).toBeVisible();
    await expect
      .poll(async () => {
        const state = await getEsphomeStateForGate("gate-2");
        return state.commands.some(
          (command) =>
            command.action === "turn_on" && command.params.effect === "Strobe",
        );
      })
      .toBe(true);

    await behavior.getByRole("radio", { name: "Off" }).click();
    await page.getByRole("button", { name: "Turn off gate" }).click();
    await expect
      .poll(async () => {
        const state = await getEsphomeStateForGate("gate-2");
        return state.commands.some((command) => command.action === "turn_off");
      })
      .toBe(true);
  });

  test("Add step wizard buttons add a wait", async ({ page }) => {
    await resetRoutineSteps("heat.go");

    try {
      await page.goto("/routines");
      const card = routineCard(page, "heat.go");
      await card.getByRole("button", { name: "Add step" }).click();

      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Add step" }),
      ).toBeVisible();
      const continueButton = dialog.getByRole("button", { name: "Continue" });
      await expect(continueButton).toBeDisabled();

      await dialog
        .getByRole("button", { name: /Pause before the next step/ })
        .click();
      await expect(continueButton).toBeEnabled();
      await continueButton.click();

      await dialog.getByLabel("Duration (seconds)").fill("2");
      await dialog.getByRole("button", { name: "Add step" }).click();
      await expect(dialog).toBeHidden();
      await expect(card).toContainText("Wait 2s");
    } finally {
      await resetRoutineSteps("heat.go");
    }
  });

  test("routine effect dropdown selects Strobe", async ({ page }) => {
    await resetRoutineSteps("heat.arm_started");
    await page.request.post("/api/gates/discover");

    try {
      await page.goto("/routines");
      const card = routineCard(page, "heat.arm_started");
      await card.getByRole("button", { name: "Add step" }).click();

      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", { name: /Send a color, effect, or off/ })
        .click();
      await dialog.getByRole("button", { name: "Continue" }).click();

      await expect(
        dialog.getByRole("radio", { name: "All gates" }),
      ).toBeChecked();
      await dialog.getByRole("button", { name: "Continue" }).click();

      await dialog.getByRole("button", { name: /Run a light effect/ }).click();
      await dialog.getByRole("button", { name: "Continue" }).click();

      const effect = dialog.getByRole("combobox");
      await expect(effect).toContainText("Pulse");
      await effect.click();
      await page.getByRole("option", { name: /Strobe/ }).click();
      await expect(effect).toContainText("Strobe");

      await dialog.getByRole("button", { name: "Add step" }).click();
      await expect(dialog).toBeHidden();
      await expect(card).toContainText("effect: Strobe");
    } finally {
      await resetRoutineSteps("heat.arm_started");
    }
  });

  test("scan, forget dialog, and gate switches respond", async ({ page }) => {
    await page.request.post("/api/gates/discover");

    try {
      await page.goto("/gates");
      await expect(page.getByTestId("gate-row-gate-2")).toBeVisible({
        timeout: 10_000,
      });

      await page.getByRole("button", { name: "Scan now" }).click();
      await expect(page.getByText("Scan complete")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Scan now" }),
      ).toBeEnabled();

      const row = page.getByTestId("gate-row-gate-2");
      const enabled = row.getByRole("switch", { name: "Enabled gate-2" });
      await expect(enabled).toBeChecked();
      await enabled.click();
      await expect(enabled).not.toBeChecked();
      await enabled.click();
      await expect(enabled).toBeChecked();

      const start = row.getByRole("switch", { name: "Start gate for gate-2" });
      await start.click();
      await expect(start).toBeChecked();

      await row.getByRole("button", { name: "Forget" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(
        dialog.getByRole("heading", { name: /Forget gate-2/ }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: "Forget" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Forget" })
        .click();
      await expect(page.getByTestId("gate-row-gate-2")).toHaveCount(0);
    } finally {
      await page.request.post("/api/gates/discover");
    }
  });

  test("log filter buttons change the active filter", async ({ page }) => {
    await page.goto("/logs");
    await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible();

    const all = page.getByRole("button", { name: "All", exact: true });
    const warn = page.getByRole("button", { name: "Warn+" });
    await expect(all).toHaveAttribute("aria-pressed", "true");

    await warn.click();
    await expect(warn).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("button", { name: "Error", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Error", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
  });
});
