"use client";

import { useEffect, useMemo, useState } from "react";
import { BrightnessControl } from "@/components/brightness-control";
import { ColorPicker } from "@/components/color-picker";
import {
  EffectPicker,
  type EffectSelection,
} from "@/components/effect-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Gate } from "@/lib/config/schema";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import { defaultEffectSelection } from "@/lib/effects";
import { getRaceEventDef, type RaceEventType } from "@/lib/race-events";
import type { MappingAction, SequenceStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_KINDS = [
  {
    id: "effect",
    label: "Effect",
    description: "Run an ESPHome light effect on the strip",
  },
  {
    id: "solid",
    label: "Solid color",
    description: "Set a fixed RGB color",
  },
  {
    id: "pilot_color",
    label: "Pilot color",
    description: "Use the crossing pilot's assigned color",
  },
  {
    id: "off",
    label: "Off",
    description: "Turn the gate LEDs off",
  },
] as const;

type ActionKind = (typeof ACTION_KINDS)[number]["id"];
type StepKind = "action" | "delay";

type RoutineStepWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: RaceEventType;
  gates: Gate[];
  defaultBrightnessPercent: number;
  onSubmit: (step: Omit<SequenceStep, "id">) => Promise<void>;
};

export function RoutineStepWizard({
  open,
  onOpenChange,
  eventType,
  gates,
  defaultBrightnessPercent,
  onSubmit,
}: RoutineStepWizardProps) {
  const eventDef = getRaceEventDef(eventType);
  const [wizardStep, setWizardStep] = useState(0);
  const [stepKind, setStepKind] = useState<StepKind | null>(null);
  const [delaySeconds, setDelaySeconds] = useState("1");
  const [target, setTarget] = useState("all");
  const [actionKind, setActionKind] = useState<ActionKind>("solid");
  const [effect, setEffect] = useState<EffectSelection>(
    defaultEffectSelection("pulse"),
  );
  const [rgb, setRgb] = useState({ r: 0, g: 255, b: 0 });
  const [brightnessPercent, setBrightnessPercent] = useState(
    defaultBrightnessPercent,
  );
  const [submitting, setSubmitting] = useState(false);

  const stepLabels = useMemo(() => {
    if (stepKind === "delay") return ["Type", "Wait"];
    if (stepKind === "action") return ["Type", "Target", "Action", "Configure"];
    return ["Type"];
  }, [stepKind]);

  const targetItems = useMemo(
    () => [
      { value: "all", label: "All gates" },
      { value: "start_gate", label: "Start gate" },
      ...gates.map((g) => ({ value: `gate:${g.id}`, label: g.id })),
    ],
    [gates],
  );

  useEffect(() => {
    if (!open) return;
    setWizardStep(0);
    setStepKind(null);
    setDelaySeconds("1");
    setTarget("all");
    setActionKind("solid");
    setEffect(defaultEffectSelection("pulse"));
    setRgb({ r: 0, g: 255, b: 0 });
    setBrightnessPercent(defaultBrightnessPercent);
    setSubmitting(false);
  }, [open, eventType, defaultBrightnessPercent]);

  function buildAction(): MappingAction {
    if (actionKind === "effect") {
      return {
        kind: "effect",
        effectId: effect.effectId,
        params: effect.params,
        brightnessPercent,
        ...(effect.r !== undefined &&
          effect.g !== undefined &&
          effect.b !== undefined && {
            r: effect.r,
            g: effect.g,
            b: effect.b,
          }),
      };
    }
    if (actionKind === "solid") {
      return { kind: "solid", ...rgb, brightnessPercent };
    }
    if (actionKind === "pilot_color") {
      return { kind: "pilot_color", brightnessPercent };
    }
    return { kind: "off" };
  }

  function buildStep(): Omit<SequenceStep, "id"> {
    if (stepKind === "delay") {
      const seconds = Number(delaySeconds);
      return { kind: "delay", ms: Math.round(seconds * 1000) } as Omit<
        SequenceStep,
        "id"
      >;
    }

    const actualTarget = target.startsWith("gate:") ? "gate_id" : target;
    const targetGateId = target.startsWith("gate:")
      ? target.slice("gate:".length)
      : null;

    return {
      kind: "action",
      target: actualTarget as "all" | "start_gate" | "gate_id",
      targetGateId,
      action: buildAction(),
    } as Omit<SequenceStep, "id">;
  }

  const isLastStep =
    stepKind === "delay" ? wizardStep === 1 : wizardStep === 3;

  function canContinue(): boolean {
    if (wizardStep === 0) return stepKind !== null;
    if (stepKind === "delay") {
      const seconds = Number(delaySeconds);
      return Number.isFinite(seconds) && seconds >= 0;
    }
    if (wizardStep === 1) return Boolean(target);
    if (wizardStep === 2) return Boolean(actionKind);
    return true;
  }

  async function handlePrimary() {
    if (!isLastStep) {
      setWizardStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(buildStep());
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (wizardStep === 0) {
      onOpenChange(false);
      return;
    }
    if (wizardStep === 1) {
      setStepKind(null);
    }
    setWizardStep((s) => s - 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add step</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-foreground">{eventType}</span>
            {eventDef ? ` — ${eventDef.label}` : null}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-2 text-xs">
          {stepLabels.map((name, i) => (
            <li
              key={name}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-center",
                i === wizardStep
                  ? "border-foreground/20 bg-muted font-medium"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {i + 1}. {name}
            </li>
          ))}
        </ol>

        <div className="min-h-40 space-y-4">
          {wizardStep === 0 && (
            <div className="grid gap-2">
              <Label>What kind of step?</Label>
              <button
                type="button"
                onClick={() => setStepKind("action")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  stepKind === "action"
                    ? "border-foreground/25 bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">Gate action</div>
                <div className="text-sm text-muted-foreground">
                  Send a color, effect, or off command to gates
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStepKind("delay")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  stepKind === "delay"
                    ? "border-foreground/25 bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">Wait</div>
                <div className="text-sm text-muted-foreground">
                  Pause before the next step runs
                </div>
              </button>
            </div>
          )}

          {wizardStep === 1 && stepKind === "delay" && (
            <div className="space-y-2">
              <Label htmlFor="delay-seconds">Duration (seconds)</Label>
              <Input
                id="delay-seconds"
                type="number"
                min={0}
                step={0.1}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
              />
            </div>
          )}

          {wizardStep === 1 && stepKind === "action" && (
            <div className="space-y-2">
              <Label>Which gates should respond?</Label>
              <Select
                value={target}
                onValueChange={(v) => v && setTarget(v)}
                items={targetItems}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All gates</SelectItem>
                  <SelectItem value="start_gate">Start gate</SelectItem>
                  {gates.map((g) => (
                    <SelectItem key={g.id} value={`gate:${g.id}`}>
                      {g.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {wizardStep === 2 && stepKind === "action" && (
            <div className="grid gap-2">
              <Label>What should the gates do?</Label>
              {ACTION_KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => setActionKind(kind.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    actionKind === kind.id
                      ? "border-foreground/25 bg-muted"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="font-medium">{kind.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {kind.description}
                  </div>
                </button>
              ))}
            </div>
          )}

          {wizardStep === 3 && stepKind === "action" && actionKind === "off" && (
            <p className="text-sm text-muted-foreground">
              Gates will turn off when this step runs.
            </p>
          )}

          {wizardStep === 3 && stepKind === "action" && actionKind === "effect" && (
            <EffectPicker value={effect} onChange={setEffect} />
          )}

          {wizardStep === 3 && stepKind === "action" && actionKind === "solid" && (
            <ColorPicker value={rgb} onChange={setRgb} label="Color" />
          )}

          {wizardStep === 3 &&
            stepKind === "action" &&
            (actionKind === "effect" ||
              actionKind === "solid" ||
              actionKind === "pilot_color") && (
              <BrightnessControl
                value={brightnessPercent}
                onChange={setBrightnessPercent}
              />
            )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleBack}>
            {wizardStep === 0 ? "Cancel" : "Back"}
          </Button>
          <Button
            type="button"
            onClick={() => void handlePrimary()}
            disabled={!canContinue() || submitting}
          >
            {isLastStep ? (submitting ? "Adding…" : "Add step") : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
