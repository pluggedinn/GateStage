import type { Broadcaster } from "@/lib/broadcaster";
import type { Gate } from "@/lib/config/schema";
import {
  getDefaultBrightnessPercent,
  getGates,
  getSequence,
} from "@/lib/config/store";
import { resolveBrightnessPercent } from "@/lib/brightness";
import { describeEffectAction } from "@/lib/effects";
import { describeDelayStep } from "@/lib/sequence-display";
import { type EsphomeCommand, sendEsphomeCommand } from "@/lib/esphome";
import type {
  MappingAction,
  RaceActionEnvelope,
  RaceEvent,
  SequenceActionStep,
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
    if (event.type === "pilot.crossing") {
      const last = lastCrossingByPilot.get(event.pilot.id) ?? 0;
      const now = Date.now();
      if (now - last < crossingDebounceMs) return;
      lastCrossingByPilot.set(event.pilot.id, now);
    }

    const sequence = getSequence(event.type);
    if (!sequence?.enabled || sequence.steps.length === 0) return;

    const enabledGates = getGates().filter((g) => g.enabled);

    for (const step of sequence.steps) {
      if (step.kind === "delay") {
        const label = describeDelayStep(step.ms);
        this.broadcaster.emitRaceAction({
          gateId: ROUTINE_LOG_GATE,
          command: label,
          success: true,
          at: new Date().toISOString(),
        });
        await sleep(step.ms);
        continue;
      }

      const targets = this.resolveTargets(
        step.target,
        step.targetGateId,
        enabledGates,
      );
      const command = this.actionToCommand(step.action, event);
      if (!command) continue;

      await Promise.allSettled(
        targets.map(async (gate) => {
          const label = this.describeCommand(command);
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
          } catch (err) {
            const envelope: RaceActionEnvelope = {
              gateId: gate.id,
              command: label,
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
              at: new Date().toISOString(),
            };
            this.broadcaster.emitRaceAction(envelope);
          }
        }),
      );
    }
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
        return {
          kind: "effect",
          effectId,
          params: action.params,
          brightnessPercent: resolveBrightnessPercent(
            action,
            getDefaultBrightnessPercent(),
          ),
          ...(action.r !== undefined && {
            r: action.r,
            g: action.g,
            b: action.b,
          }),
        };
      }
      case "solid":
        return {
          kind: "rgb",
          r: action.r,
          g: action.g,
          b: action.b,
          brightnessPercent: resolveBrightnessPercent(
            action,
            getDefaultBrightnessPercent(),
          ),
        };
      case "off":
        return { kind: "off" };
      case "pilot_color": {
        const pilot =
          event.type === "pilot.crossing"
            ? event.pilot
            : event.type === "heat.loaded" && event.pilots[0]
              ? event.pilots[0]
              : null;
        if (!pilot) return null;
        return {
          kind: "rgb",
          r: pilot.color.r,
          g: pilot.color.g,
          b: pilot.color.b,
          brightnessPercent: resolveBrightnessPercent(
            action,
            getDefaultBrightnessPercent(),
          ),
        };
      }
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
