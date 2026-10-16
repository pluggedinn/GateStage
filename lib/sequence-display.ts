import { describeChoreographyAction } from "@/lib/choreography";
import { rgbToHex } from "@/lib/color";
import { describeColorSource, isDynamicColorSource } from "@/lib/color-source";
import { describeEffectAction } from "@/lib/effects";
import { ALL_EXCEPT_START_LABEL } from "@/lib/gate-targets";
import type { MappingAction, MappingTarget, SequenceStep } from "@/lib/types";

function brightnessSuffix(percent?: number) {
  if (percent === undefined) return "";
  return ` @ ${percent}%`;
}

export function fadeSuffix(fadeMs?: number): string {
  if (!fadeMs || fadeMs <= 0) return "";
  const seconds = fadeMs / 1000;
  const label = Number.isInteger(seconds)
    ? String(seconds)
    : String(Number(seconds.toFixed(2)));
  return ` · fade ${label}s`;
}

export function describeStepTarget(
  target: MappingTarget,
  targetGateId: string | null,
): string {
  if (target === "gate_id" && targetGateId) return targetGateId;
  if (target === "start_gate") return "Start gate";
  if (target === "all_except_start") return ALL_EXCEPT_START_LABEL;
  return "All gates";
}

export function describeGateAction(action: MappingAction): string {
  if (action.kind === "effect") {
    const effectId = action.effectId ?? action.name ?? "pulse";
    const colorLabel = isDynamicColorSource(action.colorSource)
      ? ` · ${describeColorSource(action.colorSource)}`
      : action.r !== undefined &&
          action.g !== undefined &&
          action.b !== undefined
        ? ` · ${rgbToHex({ r: action.r, g: action.g, b: action.b })}`
        : "";
    return (
      describeEffectAction(effectId, action.params) +
      colorLabel +
      brightnessSuffix(action.brightnessPercent) +
      fadeSuffix(action.fadeMs)
    );
  }
  if (action.kind === "solid") {
    if (isDynamicColorSource(action.colorSource)) {
      return (
        describeColorSource(action.colorSource) +
        brightnessSuffix(action.brightnessPercent) +
        fadeSuffix(action.fadeMs)
      );
    }
    if (
      action.r !== undefined &&
      action.g !== undefined &&
      action.b !== undefined
    ) {
      return (
        rgbToHex({ r: action.r, g: action.g, b: action.b }) +
        brightnessSuffix(action.brightnessPercent) +
        fadeSuffix(action.fadeMs)
      );
    }
    return `Solid color${brightnessSuffix(action.brightnessPercent)}${fadeSuffix(action.fadeMs)}`;
  }
  if (action.kind === "pilot_color") {
    return `Pilot color${brightnessSuffix(action.brightnessPercent)}${fadeSuffix(action.fadeMs)}`;
  }
  if (action.kind === "choreography") {
    return describeChoreographyAction(action);
  }
  return `Off${fadeSuffix(action.fadeMs)}`;
}

export function describeDelayStep(ms: number): string {
  if (ms % 1000 === 0 && ms >= 1000) {
    const seconds = ms / 1000;
    return `Wait ${seconds}s`;
  }
  return `Wait ${ms}ms`;
}

export function describeSequenceStep(step: SequenceStep): string {
  if (step.kind === "delay") return describeDelayStep(step.ms);
  return `${describeStepTarget(step.target, step.targetGateId)} → ${describeGateAction(step.action)}`;
}

export function formatDelayMs(ms: number): string {
  return describeDelayStep(ms);
}
