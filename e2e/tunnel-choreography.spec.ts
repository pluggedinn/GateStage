import { expect, test } from "@playwright/test";
import { ESPHOME_MOCK_FLEET } from "../lib/dev/esphome-mock-fleet";
import {
  emitNextEvent,
  getEsphomeStateForGate,
  resetEsphome,
} from "./helpers/mocks";

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

test.describe("Tunnel choreography", () => {
  test.beforeEach(async () => {
    await resetEsphome();
    await fetch(`${API}/api/gates/discover`, { method: "POST" });

    const gatesRes = await fetch(`${API}/api/gates`);
    const gates = (await gatesRes.json()) as { id: string }[];
    const orderedIds = ["gate-start", "gate-2", "gate-3", "gate-4", "gate-5", "gate-finish"].filter(
      (id) => gates.some((g) => g.id === id),
    );
    if (orderedIds.length >= 2) {
      await fetch(`${API}/api/gates/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
    }

    await resetRoutineSteps("heat.finished");
  });

  test("heat.finished runs tunnel in gate order then turns all off", async () => {
    const stepRes = await fetch(`${API}/api/sequences/heat.finished/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "choreography",
          choreographyId: "tunnel",
          params: {
            r: 255,
            g: 0,
            b: 0,
            brightnessPercent: 5,
            durationMs: 800,
            easing: "easeInQuad",
          },
        },
      }),
    });
    expect(stepRes.ok).toBeTruthy();

    await emitNextEvent("heat.finished");

    await expect
      .poll(async () => {
        const start = await getEsphomeStateForGate("gate-start");
        const second = await getEsphomeStateForGate("gate-2");
        const startOn = start.commands.some((c) => c.action === "turn_on");
        const secondOn = second.commands.some((c) => c.action === "turn_on");
        return startOn && secondOn;
      })
      .toBe(true);

    const startState = await getEsphomeStateForGate("gate-start");
    const secondState = await getEsphomeStateForGate("gate-2");
    const startOn = startState.commands.find((c) => c.action === "turn_on");
    const secondOn = secondState.commands.find((c) => c.action === "turn_on");
    expect(startOn).toBeTruthy();
    expect(secondOn).toBeTruthy();
    if (!startOn || !secondOn) return;
    expect(Date.parse(startOn.at)).toBeLessThan(Date.parse(secondOn.at));

    await expect
      .poll(
        async () => {
          const states = await Promise.all(
            ESPHOME_MOCK_FLEET.slice(0, 3).map((g) =>
              getEsphomeStateForGate(g.id),
            ),
          );
          return states.every((state) =>
            state.commands.some((c) => c.action === "turn_off"),
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test("rejects choreography when target is not all gates", async () => {
    const stepRes = await fetch(`${API}/api/sequences/heat.arm_started/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "start_gate",
        targetGateId: null,
        action: {
          kind: "choreography",
          choreographyId: "tunnel",
          params: {
            r: 255,
            g: 0,
            b: 0,
            durationMs: 1000,
            easing: "easeInQuad",
          },
        },
      }),
    });
    expect(stepRes.status).toBe(400);
  });

  test("rejects pilot color on routines without pilot context", async () => {
    const stepRes = await fetch(`${API}/api/sequences/heat.go/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "solid",
          colorSource: "pilot",
          brightnessPercent: 5,
        },
      }),
    });
    expect(stepRes.status).toBe(400);
  });

  test("accepts pilot color on pilot.crossing routines", async () => {
    await resetRoutineSteps("pilot.crossing");
    const stepRes = await fetch(`${API}/api/sequences/pilot.crossing/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "solid",
          colorSource: "pilot",
          brightnessPercent: 5,
        },
      }),
    });
    expect(stepRes.ok).toBeTruthy();
  });
});
