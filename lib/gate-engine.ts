import { resolveBrightnessPercent } from "@/lib/brightness";
import type { Broadcaster } from "@/lib/broadcaster";
import { runChoreography } from "@/lib/choreography";
import { resolveActionColor } from "@/lib/color-source";
import type { Gate } from "@/lib/config/schema";
import {
  getDefaultBrightnessPercent,
  getGates,
  getSequence,
} from "@/lib/config/store";
import { describeEffectAction } from "@/lib/effects";
import { type EsphomeCommand, sendEsphomeCommand } from "@/lib/esphome";
import { ingestRaceEvent, resolvePilotColor } from "@/lib/heat-state";
import type { RaceEventType } from "@/lib/race-events";
import { describeDelayStep } from "@/lib/sequence-display";
import { createTestRaceEvent } from "@/lib/test-race-event";
import type {
  MappingAction,
  RaceActionEnvelope,
  RaceEvent,
  SequenceActionStep,
  SequenceStep,
} from "@/lib/types";

const crossingDebounceMs = 400;
const ROUTINE_LOG_GATE = "routine";
const lastCrossingByPilot = new Map<string, number>();

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class GateEngine {
  constructor(private broadcaster: Broadcaster) {}

  async dispatch(event: RaceEvent) {
    ingestRaceEvent(event);

    if (event.type === "pilot.crossing") {
      const last = lastCrossingByPilot.get(event.pilot.id) ?? 0;
      const now = Date.now();
      if (now - last < crossingDebounceMs) return;
      lastCrossingByPilot.set(event.pilot.id, now);
    }

    const sequence = getSequence(event.type);
    if (!sequence?.enabled || sequence.steps.length === 0) return;

    await this.executeSequence(sequence.steps, event);
  }

  /**
   * Manually run a routine for testing from the Routines UI.
   * Ignores the enabled flag so disabled routines can still be previewed.
   */
  async runRoutine(
    eventType: RaceEventType,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const sequence = getSequence(eventType);
    if (!sequence) {
      return { ok: false, error: "Routine not found" };
    }
    if (sequence.steps.length === 0) {
      return { ok: false, error: "Routine has no steps" };
    }

    const event = createTestRaceEvent(eventType);

    // Seed heat pilots so pilot-color actions resolve during a standalone test.
    if (event.type !== "heat.loaded") {
      ingestRaceEvent(createTestRaceEvent("heat.loaded"));
    }

    if (event.type === "pilot.crossing") {
      lastCrossingByPilot.delete(event.pilot.id);
    }

    ingestRaceEvent(event);
    await this.executeSequence(sequence.steps, event);
    return { ok: true };
  }

  private async executeSequence(steps: SequenceStep[], event: RaceEvent) {
    const enabledGates = getGates().filter((g) => g.enabled);

    for (const step of steps) {
      await this.runStep(step, event, enabledGates);
    }

    const lastStep = steps[steps.length - 1];
    if (isChoreographyStep(lastStep)) {
      await this.turnOffAll(enabledGates);
    }
  }

  private async runStep(
    step: SequenceStep,
    event: RaceEvent,
    enabledGates: Gate[],
  ) {
    if (step.kind === "delay") {
      const label = describeDelayStep(step.ms);
      this.broadcaster.emitRaceAction({
        gateId: ROUTINE_LOG_GATE,
        command: label,
        success: true,
        at: new Date().toISOString(),
      });
      await sleep(step.ms);
      return;
    }

    if (step.action.kind === "choreography") {
      await runChoreography(step.action, {
        gates: enabledGates,
        event,
        sleep,
        sendToGate: async (gate, command, commandLabel) =>
          this.sendCommandToGate(gate, command, commandLabel),
      });
      return;
    }

    const targets = this.resolveTargets(
      step.target,
      step.targetGateId,
      enabledGates,
    );
    const command = this.actionToCommand(step.action, event);
    if (!command) return;

    await Promise.allSettled(
      targets.map(async (gate) => {
        const label = this.describeCommand(command);
        await this.sendCommandToGate(gate, command, label);
      }),
    );
  }

  private async sendCommandToGate(
    gate: Gate,
    command: EsphomeCommand,
    label: string,
  ) {
    try {
      const res = await sendEsphomeCommand(gate.host, command);
      const envelope: RaceActionEnvelope = {
        gateId: gate.id,
        command: label,
        success: res.ok,
        error: res.ok ? undefined : `HTTP ${res.status}`,
        at: new Date().toISOString(),
      };
      this.broadcaster.emitRaceAction(envelope);
      return { ok: res.ok, status: res.status };
    } catch (err) {
      const envelope: RaceActionEnvelope = {
        gateId: gate.id,
        command: label,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        at: new Date().toISOString(),
      };
      this.broadcaster.emitRaceAction(envelope);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  private async turnOffAll(gates: Gate[]) {
    await Promise.allSettled(
      gates.map((gate) =>
        this.sendCommandToGate(gate, { kind: "off" }, "turn_off"),
      ),
    );
  }

  private resolveTargets(
    target: SequenceActionStep["target"],
    targetGateId: string | null,
    enabledGates: Gate[],
  ) {
    if (target === "all") return enabledGates;
    if (target === "start_gate") {
      const start = enabledGates.find((g) => g.isStartGate);
      return start ? [start] : [];
    }
    if (target === "gate_id" && targetGateId) {
      const gate = enabledGates.find((g) => g.id === targetGateId);
      return gate ? [gate] : [];
    }
    return [];
  }

  private actionToCommand(
    action: MappingAction,
    event: RaceEvent,
  ): EsphomeCommand | null {
    switch (action.kind) {
      case "effect": {
        const effectId = action.effectId ?? action.name ?? "pulse";
        const rgb = resolveActionColor(action, event);
        return {
          kind: "effect",
          effectId,
          params: action.params,
          brightnessPercent: resolveBrightnessPercent(
            action,
            getDefaultBrightnessPercent(),
          ),
          ...(rgb && {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
          }),
        };
      }
      case "solid": {
        const rgb = resolveActionColor(action, event);
        if (!rgb) return null;
        return {
          kind: "rgb",
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          brightnessPercent: resolveBrightnessPercent(
            action,
            getDefaultBrightnessPercent(),
          ),
        };
      }
      case "off":
        return { kind: "off" };
      case "pilot_color": {
        const color = resolvePilotColor(event);
        if (!color) return null;
        return {
          kind: "rgb",
          r: color.r,
          g: color.g,
          b: color.b,
          brightnessPercent: resolveBrightnessPercent(
            action,
            getDefaultBrightnessPercent(),
          ),
        };
      }
      case "choreography":
        return null;
      default:
        return null;
    }
  }

  private describeCommand(command: EsphomeCommand): string {
    if (command.kind === "off") return "turn_off";
    if (command.kind === "effect") {
      const label = describeEffectAction(command.effectId, command.params);
      return `${label} @ ${command.brightnessPercent ?? getDefaultBrightnessPercent()}%`;
    }
    return `rgb(${command.r},${command.g},${command.b}) @ ${command.brightnessPercent ?? getDefaultBrightnessPercent()}%`;
  }
}

function isChoreographyStep(step: SequenceStep | undefined): boolean {
  return step?.kind === "action" && step.action.kind === "choreography";
}
