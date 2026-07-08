"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoutineStepWizard } from "@/components/routine-step-wizard";
import { RoutineStepsSortableTable } from "@/components/routine-steps-sortable-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import { rgbToHex } from "@/lib/color";
import type { EventSequence, Gate } from "@/lib/config/schema";
import { RACE_EVENT_TYPES, type RaceEventType } from "@/lib/race-events";
import {
  describeDelayStep,
  describeGateAction,
  describeSequenceStep,
  describeStepTarget,
} from "@/lib/sequence-display";
import type { MappingAction, SequenceStep } from "@/lib/types";

export default function RoutinesPage() {
  const [sequences, setSequences] = useState<EventSequence[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [defaultBrightnessPercent, setDefaultBrightnessPercent] = useState(
    DEFAULT_BRIGHTNESS_PERCENT,
  );
  const [wizardEvent, setWizardEvent] = useState<RaceEventType | null>(null);
  const [stepToDelete, setStepToDelete] = useState<{
    eventType: RaceEventType;
    stepId: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [sRes, gRes, settingsRes] = await Promise.all([
      fetch("/api/sequences"),
      fetch("/api/gates"),
      fetch("/api/settings"),
    ]);
    setSequences(await sRes.json());
    setGates(await gRes.json());
    if (settingsRes.ok) {
      const settings = (await settingsRes.json()) as {
        defaultBrightnessPercent?: number;
      };
      if (settings.defaultBrightnessPercent !== undefined) {
        setDefaultBrightnessPercent(settings.defaultBrightnessPercent);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sequenceByEvent = useMemo(() => {
    const map = new Map<string, EventSequence>();
    for (const sequence of sequences) {
      map.set(sequence.eventType, sequence);
    }
    return map;
  }, [sequences]);

  async function addStep(
    eventType: RaceEventType,
    step: Omit<SequenceStep, "id">,
  ) {
    const res = await fetch(
      `/api/sequences/${encodeURIComponent(eventType)}/steps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step),
      },
    );
    if (res.ok) {
      toast.success("Step added", { description: eventType });
      await load();
    } else {
      toast.error("Could not add step");
      throw new Error("add failed");
    }
  }

  async function toggleRoutine(eventType: RaceEventType, enabled: boolean) {
    const res = await fetch(`/api/sequences/${encodeURIComponent(eventType)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      toast.error("Could not update routine");
      return;
    }
    await load();
  }

  async function deleteStep(eventType: RaceEventType, stepId: string) {
    const res = await fetch(
      `/api/sequences/${encodeURIComponent(eventType)}/steps/${encodeURIComponent(stepId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Could not remove step");
      return;
    }
    toast.success("Step removed");
    await load();
  }

  async function reorderSteps(
    eventType: RaceEventType,
    orderedIds: string[],
  ) {
    const previous = sequences;
    const sequence = sequenceByEvent.get(eventType);
    if (!sequence) return;

    const byId = new Map(sequence.steps.map((s) => [s.id, s]));
    const optimisticSteps = orderedIds
      .map((id) => byId.get(id))
      .filter((s): s is SequenceStep => s !== undefined);

    setSequences(
      previous.map((s) =>
        s.eventType === eventType
          ? { ...s, steps: optimisticSteps }
          : s,
      ),
    );

    const res = await fetch(
      `/api/sequences/${encodeURIComponent(eventType)}/steps/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      },
    );

    if (!res.ok) {
      setSequences(previous);
      const data = (await res.json()) as { error?: string };
      toast.error("Could not reorder steps", {
        description: data.error ?? "Try again.",
      });
      return;
    }

    const updated = (await res.json()) as EventSequence;
    setSequences((current) =>
      current.map((s) => (s.eventType === eventType ? updated : s)),
    );
  }

  function renderActionSwatch(action: MappingAction) {
    if (action.kind === "solid") {
      if (action.colorSource === "pilot") return null;
      if (
        action.r !== undefined &&
        action.g !== undefined &&
        action.b !== undefined
      ) {
        return rgbToHex({ r: action.r, g: action.g, b: action.b });
      }
      return null;
    }
    if (action.kind === "pilot_color") return null;
    if (
      action.kind === "effect" &&
      action.colorSource !== "pilot" &&
      action.r !== undefined &&
      action.g !== undefined &&
      action.b !== undefined
    ) {
      return rgbToHex({ r: action.r, g: action.g, b: action.b });
    }
    return null;
  }

  function renderStepCell(step: SequenceStep) {
    if (step.kind === "delay") {
      return (
        <span className="text-muted-foreground">
          {describeDelayStep(step.ms)}
        </span>
      );
    }

    const swatch = renderActionSwatch(step.action);
    const label = describeGateAction(step.action);
    const prefix = `${describeStepTarget(step.target, step.targetGateId)} → `;

    if (swatch) {
      return (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-sm border border-border"
            style={{ backgroundColor: swatch }}
          />
          {prefix}
          {label}
        </span>
      );
    }

    return describeSequenceStep(step);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Routines</h1>
        <p className="text-base text-muted-foreground">
          Ordered steps that run when a race event fires — gate actions and
          waits, one after another
        </p>
      </div>

      <div className="space-y-4">
        {RACE_EVENT_TYPES.map((event) => {
          const sequence = sequenceByEvent.get(event.id);
          const steps = sequence?.steps ?? [];
          return (
            <Card key={event.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="font-mono text-base">
                    {event.id}
                  </CardTitle>
                  <CardDescription>{event.description}</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {sequence && (
                    <div className="flex items-center gap-2">
                      <LabelledSwitch
                        checked={sequence.enabled}
                        onCheckedChange={(enabled) =>
                          void toggleRoutine(event.id, enabled)
                        }
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setWizardEvent(event.id)}
                  >
                    Add step
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No steps yet. Add gate actions or waits to build this
                    routine.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Drag rows to set run order.
                    </p>
                    <RoutineStepsSortableTable
                      eventType={event.id}
                      steps={steps}
                      renderStepCell={renderStepCell}
                      onReorder={(orderedIds) =>
                        void reorderSteps(event.id, orderedIds)
                      }
                      onDelete={(stepId) =>
                        setStepToDelete({ eventType: event.id, stepId })
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {wizardEvent && (
        <RoutineStepWizard
          open={wizardEvent !== null}
          onOpenChange={(open) => !open && setWizardEvent(null)}
          eventType={wizardEvent}
          gates={gates}
          defaultBrightnessPercent={defaultBrightnessPercent}
          onSubmit={(step) => addStep(wizardEvent, step)}
        />
      )}

      <ConfirmDialog
        open={stepToDelete !== null}
        onOpenChange={(open) => !open && setStepToDelete(null)}
        title="Delete step?"
        description="This step will be removed from the routine."
        onConfirm={() =>
          stepToDelete
            ? deleteStep(stepToDelete.eventType, stepToDelete.stepId)
            : Promise.resolve()
        }
      />
    </div>
  );
}

function LabelledSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      Enabled
    </label>
  );
}
