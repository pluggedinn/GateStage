import { expect, test } from "@playwright/test";
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

function strobeStartDelay(state: {
  commands: Array<{
    entity: string;
    action: string;
    params: Record<string, string>;
  }>;
}): number | null {
  const command = [...state.commands]
    .reverse()
    .find(
      (entry) =>
        entry.action === "number_set" &&
        entry.entity === "FX Strobe Start Delay",
    );
  if (!command) return null;
  const value = Number(command.params.value);
  return Number.isFinite(value) ? value : null;
}

test.describe("Tunnel choreography", () => {
  test.beforeEach(async () => {
    await resetEsphome();
    await fetch(`${API}/api/gates/discover`, { method: "POST" });

    const gatesRes = await fetch(`${API}/api/gates`);
    const gates = (await gatesRes.json()) as { id: string }[];
    const orderedIds = [
      "gate-start",
      "gate-2",
      "gate-3",
      "gate-4",
      "gate-5",
      "gate-finish",
    ].filter((id) => gates.some((g) => g.id === id));
    if (orderedIds.length >= 2) {
      await fetch(`${API}/api/gates/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
    }

    await resetRoutineSteps("heat.finished");
  });

  test("heat.finished arms strobe on every gate with increasing start delays", async () => {
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
            staggerMs: 80,
            onMs: 80,
          },
        },
      }),
    });
    expect(stepRes.ok).toBeTruthy();

    await emitNextEvent("heat.finished");

    const orderedIds = [
      "gate-start",
      "gate-2",
      "gate-3",
      "gate-4",
      "gate-5",
      "gate-finish",
    ];

    await expect
      .poll(async () => {
        const states = await Promise.all(
          orderedIds.map((id) => getEsphomeStateForGate(id)),
        );
        return states.every((state) =>
          state.commands.some(
            (command) =>
              command.action === "turn_on" &&
              command.params.effect === "Strobe",
          ),
        );
      })
      .toBe(true);

    const delays: number[] = [];
    for (const id of orderedIds) {
      const state = await getEsphomeStateForGate(id);
      const turnOn = state.commands.find(
        (command) =>
          command.action === "turn_on" && command.params.effect === "Strobe",
      );
      expect(turnOn).toBeTruthy();
      expect(turnOn?.params.r).toBe("255");
      expect(
        state.commands.some((command) => command.action === "turn_off"),
      ).toBe(false);
      const delay = strobeStartDelay(state);
      expect(delay).not.toBeNull();
      delays.push(delay ?? 0);
    }

    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1] ?? 0);
    }
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
            staggerMs: 80,
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

  test("rejects winner color on routines other than heat.finished", async () => {
    const stepRes = await fetch(`${API}/api/sequences/heat.go/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "solid",
          colorSource: "winner",
          brightnessPercent: 5,
        },
      }),
    });
    expect(stepRes.status).toBe(400);
  });

  test("accepts winner color on heat.finished routines", async () => {
    const stepRes = await fetch(`${API}/api/sequences/heat.finished/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        target: "all",
        targetGateId: null,
        action: {
          kind: "solid",
          colorSource: "winner",
          brightnessPercent: 5,
        },
      }),
    });
    expect(stepRes.ok).toBeTruthy();
  });
});
