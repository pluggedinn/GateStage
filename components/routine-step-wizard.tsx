"use client";

import { useEffect, useMemo, useState } from "react";
import { BrightnessControl } from "@/components/brightness-control";
import { ColorSourcePicker } from "@/components/color-source-picker";
import { EffectPicker, type EffectSelection } from "@/components/effect-picker";
import { GateTargetPicker } from "@/components/gate-target-picker";
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
  choreographyIdFromActionKind,
  DEFAULT_STAGGER_MS,
  defaultChoreographyParams,
  getChoreographyWizardOptions,
  isChoreographyActionKind,
} from "@/lib/choreography";
import { type ColorSource, eventSupportsPilotColor } from "@/lib/color-source";
import type { Gate } from "@/lib/config/schema";
import { defaultEffectSelection, EFFECT_BY_ID } from "@/lib/effects";
import { getRaceEventDef, type RaceEventType } from "@/lib/race-events";
import type { MappingAction, SequenceStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_KINDS = [
  {
    id: "effect",
    label: "Effect",
    description: "Run a light effect on the strip",
  },
  {
    id: "solid",
    label: "Solid color",
    description: "Set a fixed RGB color",
  },
  {
    id: "off",
    label: "Off",
    description: "Turn the gate LEDs off",
  },
] as const;

const CHOREOGRAPHY_ACTION_KINDS = getChoreographyWizardOptions();

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
  const [trackEffectId, setTrackEffectId] = useState<string | null>(null);
  const [effect, setEffect] = useState<EffectSelection>(
    defaultEffectSelection("pulse"),
  );
  const [rgb, setRgb] = useState({ r: 0, g: 255, b: 0 });
  const [colorSource, setColorSource] = useState<ColorSource>("fixed");
  const showPilotColorOption = eventSupportsPilotColor(eventType);
  const [brightnessPercent, setBrightnessPercent] = useState(
    defaultBrightnessPercent,
  );
  const [tunnelStaggerMs, setTunnelStaggerMs] = useState(
    String(DEFAULT_STAGGER_MS),
  );
  const [tunnelOnMs, setTunnelOnMs] = useState(String(DEFAULT_STAGGER_MS));
  const [submitting, setSubmitting] = useState(false);

  const availableActionKinds = ACTION_KINDS;

  const trackEffectGroups = useMemo(() => {
    if (target !== "all") return [];
    const options = CHOREOGRAPHY_ACTION_KINDS.map((kind) => ({
      id: kind.actionKind,
      name: kind.label,
      description: kind.description,
    }));
    if (options.length === 0) return [];
    return [{ label: "Track", options }];
  }, [target]);

  const tunnelSelected =
    actionKind === "effect" && trackEffectId === "choreography:tunnel";

  const stepLabels = useMemo(() => {
    if (stepKind === "delay") return ["Type", "Wait"];
    if (stepKind === "action") return ["Type", "Target", "Action", "Configure"];
    return ["Type"];
  }, [stepKind]);

  useEffect(() => {
    if (!open) return;
    setWizardStep(0);
    setStepKind(null);
    setDelaySeconds("1");
    setTarget("all");
    setActionKind("solid");
    setTrackEffectId(null);
    setEffect(defaultEffectSelection("pulse"));
    setRgb({ r: 0, g: 255, b: 0 });
    setColorSource("fixed");
    setBrightnessPercent(defaultBrightnessPercent);
    setTunnelStaggerMs(String(DEFAULT_STAGGER_MS));
    setTunnelOnMs(String(DEFAULT_STAGGER_MS));
    setSubmitting(false);
  }, [open, eventType, defaultBrightnessPercent]);

  useEffect(() => {
    if (target !== "all") {
      setTrackEffectId(null);
    }
  }, [target]);

  useEffect(() => {
    if (!showPilotColorOption && colorSource === "pilot") {
      setColorSource("fixed");
    }
  }, [showPilotColorOption, colorSource]);

  function buildAction(): MappingAction {
    if (actionKind === "effect" && trackEffectId) {
      if (isChoreographyActionKind(trackEffectId)) {
        const choreographyId = choreographyIdFromActionKind(trackEffectId);
        if (choreographyId === "tunnel") {
          const staggerMs = Number(tunnelStaggerMs);
          const onMs = Number(tunnelOnMs);
          return {
            kind: "choreography",
            choreographyId: "tunnel",
            params: {
              colorSource,
              ...(colorSource === "fixed" ? rgb : {}),
              brightnessPercent,
              staggerMs: Math.round(staggerMs),
              onMs: Math.round(onMs),
            },
          };
        }
        return {
          kind: "choreography",
          choreographyId,
          params: defaultChoreographyParams(choreographyId),
        };
      }
    }
    if (actionKind === "effect") {
      const effectDef = EFFECT_BY_ID.get(effect.effectId);
      const base = {
        kind: "effect" as const,
        effectId: effect.effectId,
        params: effect.params,
        brightnessPercent,
      };
      if (effectDef?.supportsColor) {
        if (colorSource === "pilot" && showPilotColorOption) {
          return { ...base, colorSource: "pilot" as const };
        }
        return {
          ...base,
          colorSource: "fixed" as const,
          ...(effect.r !== undefined &&
            effect.g !== undefined &&
            effect.b !== undefined && {
              r: effect.r,
              g: effect.g,
              b: effect.b,
            }),
        };
      }
      return base;
    }
    if (actionKind === "solid") {
      if (colorSource === "pilot" && showPilotColorOption) {
        return { kind: "solid", colorSource: "pilot", brightnessPercent };
      }
      return {
        kind: "solid",
        colorSource: "fixed",
        ...rgb,
        brightnessPercent,
      };
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

  const isLastStep = stepKind === "delay" ? wizardStep === 1 : wizardStep === 3;

  function canContinue(): boolean {
    if (wizardStep === 0) return stepKind !== null;
    if (stepKind === "delay") {
      const seconds = Number(delaySeconds);
      return Number.isFinite(seconds) && seconds >= 0;
    }
    if (wizardStep === 1) return Boolean(target);
    if (wizardStep === 2) return Boolean(actionKind);
    if (tunnelSelected) {
      const staggerMs = Number(tunnelStaggerMs);
      const onMs = Number(tunnelOnMs);
      return (
        Number.isFinite(staggerMs) &&
        staggerMs >= 20 &&
        Number.isFinite(onMs) &&
        onMs >= 10
      );
    }
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
      <DialogContent className="max-w-lg">
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
              <GateTargetPicker
                gates={gates}
                value={target}
                onChange={setTarget}
                getGateValue={(gate) => `gate:${gate.id}`}
                extraOptions={[
                  { value: "all", label: "All gates" },
                  { value: "start_gate", label: "Start gate" },
                ]}
                ariaLabel="Which gates should respond"
              />
            </div>
          )}

          {wizardStep === 2 && stepKind === "action" && (
            <div className="grid gap-2">
              <Label>What should the gates do?</Label>
              {availableActionKinds.map((kind) => (
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

          {wizardStep === 3 &&
            stepKind === "action" &&
            actionKind === "off" && (
              <p className="text-sm text-muted-foreground">
                Gates will turn off when this step runs.
              </p>
            )}

          {wizardStep === 3 &&
            stepKind === "action" &&
            actionKind === "effect" && (
              <>
                <EffectPicker
                  value={effect}
                  onChange={setEffect}
                  colorSource={colorSource}
                  onColorSourceChange={setColorSource}
                  showPilotColorOption={showPilotColorOption}
                  extraGroups={trackEffectGroups}
                  extraSelectedId={trackEffectId}
                  onExtraSelect={(id) => {
                    setTrackEffectId(id);
                    if (
                      id &&
                      effect.r !== undefined &&
                      effect.g !== undefined &&
                      effect.b !== undefined
                    ) {
                      setRgb({ r: effect.r, g: effect.g, b: effect.b });
                    }
                  }}
                />
                {tunnelSelected && (
                  <div className="space-y-4">
                    <ColorSourcePicker
                      label="Color"
                      showPilotOption={showPilotColorOption}
                      colorSource={colorSource}
                      onColorSourceChange={setColorSource}
                      rgb={rgb}
                      onRgbChange={setRgb}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-stagger">Stagger (ms)</Label>
                      <Input
                        id="tunnel-stagger"
                        type="number"
                        min={20}
                        step={10}
                        value={tunnelStaggerMs}
                        onChange={(e) => setTunnelStaggerMs(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Delay between consecutive gates. Lap{" "}
                        {Number.isFinite(Number(tunnelStaggerMs))
                          ? Math.max(0, Math.round(Number(tunnelStaggerMs))) *
                            Math.max(gates.length, 1)
                          : "—"}
                        ms with {Math.max(gates.length, 1)}{" "}
                        {gates.length === 1 ? "gate" : "gates"}.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-on">Pulse length (ms)</Label>
                      <Input
                        id="tunnel-on"
                        type="number"
                        min={10}
                        step={10}
                        value={tunnelOnMs}
                        onChange={(e) => setTunnelOnMs(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

          {wizardStep === 3 &&
            stepKind === "action" &&
            actionKind === "solid" && (
              <ColorSourcePicker
                label="Color"
                showPilotOption={showPilotColorOption}
                colorSource={colorSource}
                onColorSourceChange={setColorSource}
                rgb={rgb}
                onRgbChange={setRgb}
              />
            )}

          {wizardStep === 3 &&
            stepKind === "action" &&
            (actionKind === "solid" || actionKind === "effect") && (
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
