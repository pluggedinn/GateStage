import { describeChoreographyAction } from "@/lib/choreography";
import { rgbToHex } from "@/lib/color";
import { describeColorSource } from "@/lib/color-source";
import { describeEffectAction } from "@/lib/effects";
import type { MappingAction, MappingTarget, SequenceStep } from "@/lib/types";

function brightnessSuffix(percent?: number) {
  if (percent === undefined) return "";
  return ` @ ${percent}%`;
}

export function describeStepTarget(
  target: MappingTarget,
  targetGateId: string | null,
): string {
  if (target === "gate_id" && targetGateId) return targetGateId;
  if (target === "start_gate") return "Start gate";
  return "All gates";
}

export function describeGateAction(action: MappingAction): string {
  if (action.kind === "effect") {
    const effectId = action.effectId ?? action.name ?? "pulse";
    const colorLabel =
      action.colorSource === "pilot"
        ? ` · ${describeColorSource("pilot")}`
        : action.r !== undefined &&
            action.g !== undefined &&
            action.b !== undefined
          ? ` · ${rgbToHex({ r: action.r, g: action.g, b: action.b })}`
          : "";
    return (
      describeEffectAction(effectId, action.params) +
      colorLabel +
      brightnessSuffix(action.brightnessPercent)
    );
  }
  if (action.kind === "solid") {
    if (action.colorSource === "pilot") {
      return (
        describeColorSource("pilot") +
        brightnessSuffix(action.brightnessPercent)
      );
    }
    if (
      action.r !== undefined &&
      action.g !== undefined &&
      action.b !== undefined
    ) {
      return (
        rgbToHex({ r: action.r, g: action.g, b: action.b }) +
        brightnessSuffix(action.brightnessPercent)
      );
    }
    return `Solid color${brightnessSuffix(action.brightnessPercent)}`;
  }
  if (action.kind === "pilot_color") {
    return `Pilot color${brightnessSuffix(action.brightnessPercent)}`;
  }
  if (action.kind === "choreography") {
    return describeChoreographyAction(action);
  }
  return "Off";
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
