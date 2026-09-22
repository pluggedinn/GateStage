import { resolveBrightnessPercent } from "@/lib/brightness";
import type { Broadcaster } from "@/lib/broadcaster";
import {
  runChoreography,
  validateChoreographyAction,
} from "@/lib/choreography";
import type { ChoreographyAction } from "@/lib/choreography/types";
import { resolveActionColor } from "@/lib/color-source";
import type { Gate } from "@/lib/config/schema";
import {
  getDefaultBrightnessPercent,
  getGates,
  getSequence,
} from "@/lib/config/store";
import { describeEffectAction } from "@/lib/effects";
import { type EsphomeCommand, sendEsphomeCommand } from "@/lib/esphome";
import { getLatestRttMs } from "@/lib/gate-presence";
import { ingestRaceEvent, resolvePilotColor } from "@/lib/heat-state";
import { logger } from "@/lib/logger";
import type { RaceEventType } from "@/lib/race-events";
import { describeDelayStep } from "@/lib/sequence-display";
import { createTestRaceEvent } from "@/lib/test-race-event";
import {
  type GateLedSnapshot,
  type MappingAction,
  NOTHING_SENT_COMMAND,
  type RaceActionEnvelope,
  type RaceEvent,
  ROUTINE_LOG_GATE_ID,
  type SequenceActionStep,
  type SequenceStep,
} from "@/lib/types";

const crossingDebounceMs = 400;
const lastCrossingByPilot = new Map<string, number>();

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function ledFromCommand(command: EsphomeCommand): GateLedSnapshot {
  if (command.kind === "off") return { mode: "off" };
  const brightnessPercent =
    command.brightnessPercent ?? getDefaultBrightnessPercent();
  if (command.kind === "effect") {
    return {
      mode: "effect",
      effectId: command.effectId,
      brightnessPercent,
      ...(command.r !== undefined &&
      command.g !== undefined &&
      command.b !== undefined
        ? { r: command.r, g: command.g, b: command.b }
        : {}),
    };
  }
  return {
    mode: "solid",
    r: command.r,
    g: command.g,
    b: command.b,
    brightnessPercent,
  };
}

export class GateEngine {
  constructor(private broadcaster: Broadcaster) {}

  async dispatch(event: RaceEvent, eventAt?: string) {
    ingestRaceEvent(event);

    if (event.type === "pilot.crossing") {
      const last = lastCrossingByPilot.get(event.pilot.id) ?? 0;
      const now = Date.now();
      if (now - last < crossingDebounceMs) {
        logger.debug(
          "gate-engine",
          `debounced ${event.type} for ${event.pilot.id}`,
        );
        return;
      }
      lastCrossingByPilot.set(event.pilot.id, now);
    }

    const sequence = getSequence(event.type);
    if (!sequence?.enabled || sequence.steps.length === 0) {
      logger.info(
        "gate-engine",
        `no routine for ${event.type} enabled=${sequence?.enabled ?? false} steps=${sequence?.steps.length ?? 0}`,
      );
      return;
    }

    logger.info(
      "gate-engine",
      `running routine ${event.type} steps=${sequence.steps.length}`,
    );
    await this.executeSequence(sequence.steps, event, eventAt);
  }

  /**
   * Manually run a routine for testing from the Routines UI.
   * Ignores the enabled flag so disabled routines can still be previewed.
   */
  async runRoutine(
    eventType: RaceEventType,
    eventAt?: string,
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
    logger.info(
      "gate-engine",
      `manual run routine ${eventType} steps=${sequence.steps.length}`,
    );
    await this.executeSequence(sequence.steps, event, eventAt);
    return { ok: true };
  }

  /** Manual page command. Recorded on the dashboard with no race event. */
  async sendManualCommand(gate: Gate, command: EsphomeCommand) {
    return this.sendCommandToGate(gate, command, this.describeCommand(command));
  }

  /**
   * Run a track choreography from Manual without broadcasting a race event.
   * The synthetic event only satisfies color resolution.
   */
  async runManualChoreography(
    action: ChoreographyAction,
  ): Promise<
    | { ok: boolean; sent: number; failed: number }
    | { ok: false; error: string; status: number }
  > {
    const error = validateChoreographyAction(action, "all");
    if (error) return { ok: false, error, status: 400 };

    const gates = getGates().filter((gate) => gate.enabled);
    if (gates.length === 0) {
      return { ok: false, error: "No enabled gates", status: 404 };
    }

    const event = createTestRaceEvent("heat.go");
    let sent = 0;
    let failed = 0;

    logger.info(
      "gate-engine",
      `manual choreography ${action.choreographyId} gates=${gates.length}`,
    );

    await runChoreography(action, {
      gates,
      event,
      sleep,
      rttMsForGate: (gateId) => getLatestRttMs(gateId),
      sendToGate: async (gate, command, commandLabel) => {
        sent += 1;
        const result = await this.sendCommandToGate(
          gate,
          command,
          commandLabel,
        );
        if (!result.ok) failed += 1;
        return result;
      },
    });

    if (sent === 0) {
      return { ok: false, error: "Choreography did not send", status: 400 };
    }

    return { ok: failed === 0, sent, failed };
  }

  private emitRoutineNotice(command: string, eventAt?: string) {
    this.broadcaster.emitRaceAction({
      gateId: ROUTINE_LOG_GATE_ID,
      command,
      success: false,
      at: new Date().toISOString(),
      eventAt,
    });
  }

  private async executeSequence(
    steps: SequenceStep[],
    event: RaceEvent,
    eventAt?: string,
  ) {
    const enabledGates = getGates().filter((g) => g.enabled);
    let gateCommands = 0;

    for (const step of steps) {
      gateCommands += await this.runStep(step, event, enabledGates, eventAt);
    }

    if (gateCommands === 0) {
      this.emitRoutineNotice(NOTHING_SENT_COMMAND, eventAt);
    }
  }

  private async runStep(
    step: SequenceStep,
    event: RaceEvent,
    enabledGates: Gate[],
    eventAt?: string,
  ): Promise<number> {
    if (step.kind === "delay") {
      const label = describeDelayStep(step.ms);
      logger.info("gate-engine", `delay ${step.ms}ms (${label})`);
      this.broadcaster.emitRaceAction({
        gateId: ROUTINE_LOG_GATE_ID,
        command: label,
        success: true,
        at: new Date().toISOString(),
        eventAt,
      });
      await sleep(step.ms);
      return 0;
    }

    if (step.action.kind === "choreography") {
      let sent = 0;
      await runChoreography(step.action, {
        gates: enabledGates,
        event,
        sleep,
        rttMsForGate: (gateId) => getLatestRttMs(gateId),
        sendToGate: async (gate, command, commandLabel) => {
          sent += 1;
          return this.sendCommandToGate(gate, command, commandLabel, eventAt);
        },
      });
      return sent;
    }

    const targets = this.resolveTargets(
      step.target,
      step.targetGateId,
      enabledGates,
    );
    const command = this.actionToCommand(step.action, event);
    if (!command || targets.length === 0) return 0;

    await Promise.allSettled(
      targets.map(async (gate) => {
        const label = this.describeCommand(command);
        await this.sendCommandToGate(gate, command, label, eventAt);
      }),
    );
    return targets.length;
  }

  private async sendCommandToGate(
    gate: Gate,
    command: EsphomeCommand,
    label: string,
    eventAt?: string,
  ) {
    const led = ledFromCommand(command);
    try {
      const res = await sendEsphomeCommand(gate.host, command);
      const envelope: RaceActionEnvelope = {
        gateId: gate.id,
        command: label,
        success: res.ok,
        error: res.ok ? undefined : `HTTP ${res.status}`,
        at: new Date().toISOString(),
        eventAt,
        led,
      };
      this.broadcaster.emitRaceAction(envelope);
      if (res.ok) {
        logger.info(
          "gate-engine",
          `${gate.id} ${label} ok host=${gate.host}`,
          command,
        );
      } else {
        logger.error(
          "gate-engine",
          `${gate.id} ${label} HTTP ${res.status} host=${gate.host}`,
          command,
        );
      }
      return { ok: res.ok, status: res.status };
    } catch (err) {
      const envelope: RaceActionEnvelope = {
        gateId: gate.id,
        command: label,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        at: new Date().toISOString(),
        eventAt,
        led,
      };
      this.broadcaster.emitRaceAction(envelope);
      logger.error(
        "gate-engine",
        `${gate.id} ${label} failed host=${gate.host}`,
        err,
      );
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
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
