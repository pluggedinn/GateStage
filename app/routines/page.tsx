"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoutineStepWizard } from "@/components/routine-step-wizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventSequence, Gate } from "@/lib/config/schema";
import { rgbToHex } from "@/lib/color";
import {
  describeDelayStep,
  describeGateAction,
  describeSequenceStep,
  describeStepTarget,
} from "@/lib/sequence-display";
import { RACE_EVENT_TYPES, type RaceEventType } from "@/lib/race-events";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
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
    const res = await fetch(`/api/sequences/${encodeURIComponent(eventType)}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step),
    });
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

  function renderActionSwatch(action: MappingAction) {
    if (action.kind === "solid") {
      return rgbToHex({ r: action.r, g: action.g, b: action.b });
    }
    if (
      action.kind === "effect" &&
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
        <span className="text-muted-foreground">{describeDelayStep(step.ms)}</span>
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
                    No steps yet. Add gate actions or waits to build this routine.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {steps.map((step, index) => (
                        <TableRow key={step.id}>
                          <TableCell className="font-mono tabular-nums text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>{renderStepCell(step)}</TableCell>
                          <TableCell className="space-x-2 text-right">
                            {step.kind === "delay" && (
                              <Badge variant="secondary">wait</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setStepToDelete({
                                  eventType: event.id,
                                  stepId: step.id,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
