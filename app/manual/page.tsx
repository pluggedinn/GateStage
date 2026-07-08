"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BrightnessControl } from "@/components/brightness-control";
import { ColorPicker } from "@/components/color-picker";
import {
  EffectPicker,
  type EffectSelection,
} from "@/components/effect-picker";
import {
  LedStripPreview,
  type LedPreviewMode,
} from "@/components/led-strip-preview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import { defaultEffectSelection } from "@/lib/effects";
import type { Gate } from "@/lib/config/schema";
import { GateTargetPicker } from "@/components/gate-target-picker";
import { cn } from "@/lib/utils";

type StepCellProps = {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

function StepCell({ step, title, description, children, className }: StepCellProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-medium leading-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

export default function ManualPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string>("");
  const [brightnessPercent, setBrightnessPercent] = useState(
    DEFAULT_BRIGHTNESS_PERCENT,
  );
  const [mode, setMode] = useState<LedPreviewMode>("effect");
  const [effect, setEffect] = useState<EffectSelection>(
    defaultEffectSelection("addressable_rainbow"),
  );
  const [rgb, setRgb] = useState({ r: 255, g: 0, b: 0 });

  const isAllGates = selectedGateId === "all";
  const hasGateSelection = Boolean(selectedGateId);

  const loadGates = useCallback(async () => {
    const res = await fetch("/api/gates");
    const data = (await res.json()) as Gate[];
    setGates(data);
    if (data[0] && !selectedGateId) setSelectedGateId(data[0].id);
  }, [selectedGateId]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = (await res.json()) as { defaultBrightnessPercent?: number };
    if (data.defaultBrightnessPercent !== undefined) {
      setBrightnessPercent(data.defaultBrightnessPercent);
    }
  }, []);

  useEffect(() => {
    void loadGates();
    void loadSettings();
  }, [loadGates, loadSettings]);

  async function send(command: Record<string, unknown>) {
    if (!selectedGateId) return;
    const res = await fetch(`/api/manual/${selectedGateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const data = (await res.json()) as {
      ok: boolean;
      status?: number;
      sent?: number;
      failed?: number;
    };
    if (data.ok) {
      toast.success("Command sent", {
        description: isAllGates
          ? `All gates (${data.sent ?? gates.length})`
          : `Gate ${selectedGateId}`,
      });
    } else {
      toast.error("Command failed", {
        description:
          isAllGates && data.failed
            ? `${data.failed} of ${data.sent} gates failed`
            : `HTTP ${data.status ?? "error"}`,
      });
    }
  }

  return (
    <>
      <div className="space-y-4 pb-40">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Manual control
          </h1>
          <p className="text-base text-muted-foreground">
            Pick a gate, choose what the LEDs should do, then send the command.
            Default brightness lives in{" "}
            <Link
              href="/settings"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Settings
            </Link>
            .
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Control steps</CardTitle>
            <CardDescription>
              Work left to right on wide screens; steps stack on smaller devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StepCell
              step={1}
              title="Select gate"
              description="Which gate strip are you controlling?"
            >
              <GateTargetPicker
                gates={gates}
                value={selectedGateId}
                onChange={setSelectedGateId}
                extraOptions={[
                  {
                    value: "all",
                    label: "All gates",
                    title: "Send to all enabled gates",
                    disabled: gates.length === 0,
                  },
                ]}
              />
            </StepCell>

            <StepCell
              step={2}
              title="Choose behavior"
              description="Effect, solid color, or off"
            >
              <div
                className="grid grid-cols-3 gap-2"
                role="radiogroup"
                aria-label="LED behavior"
              >
                {(
                  [
                    ["effect", "Effect"],
                    ["solid", "Solid"],
                    ["off", "Off"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="lg"
                    role="radio"
                    aria-checked={mode === value}
                    variant={mode === value ? "default" : "outline"}
                    className="min-h-11 px-2 text-sm sm:text-base"
                    onClick={() => setMode(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </StepCell>

            {mode === "off" ? (
              <StepCell
                step={3}
                title="Turn off"
                description={
                  isAllGates
                    ? "Send off to all enabled gates"
                    : "Send off to the selected gate"
                }
                className="sm:col-span-2 lg:col-span-1"
              >
                <Button
                  size="lg"
                  variant="destructive"
                  className="min-h-11 w-full"
                  disabled={!hasGateSelection}
                  onClick={() => void send({ kind: "off" })}
                >
                  {isAllGates ? "Turn off gates" : "Turn off gate"}
                </Button>
              </StepCell>
            ) : (
              <StepCell
                step={3}
                title="Brightness"
                description="Brightness for this command"
                className="sm:col-span-2 lg:col-span-1"
              >
                <BrightnessControl
                  value={brightnessPercent}
                  onChange={setBrightnessPercent}
                />
              </StepCell>
            )}

            {mode === "effect" ? (
              <StepCell
                step={4}
                title="Choose effect"
                description="Built-in ESPHome strip effects"
                className="sm:col-span-2 lg:col-span-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <EffectPicker
                    layout="inline"
                    className="min-w-0 flex-1"
                    value={effect}
                    onChange={(next) => {
                      setMode("effect");
                      setEffect(next);
                    }}
                  />
                  <Button
                    size="lg"
                    className="min-h-11 w-full shrink-0 md:w-auto md:min-w-36"
                    disabled={!hasGateSelection}
                    onClick={() =>
                      void send({
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
                      })
                    }
                  >
                    Apply effect
                  </Button>
                </div>
              </StepCell>
            ) : null}

            {mode === "solid" ? (
              <StepCell
                step={4}
                title="Choose color"
                description="Single RGB across the strip"
                className="sm:col-span-2 lg:col-span-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <ColorPicker
                    layout="inline"
                    className="min-w-0 flex-1"
                    value={rgb}
                    onChange={(next) => {
                      setMode("solid");
                      setRgb(next);
                    }}
                    label="Color"
                  />
                  <Button
                    size="lg"
                    className="min-h-11 w-full shrink-0 sm:w-auto sm:min-w-36"
                    disabled={!hasGateSelection}
                    onClick={() =>
                      void send({ kind: "rgb", ...rgb, brightnessPercent })
                    }
                  >
                    Apply color
                  </Button>
                </div>
              </StepCell>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border",
          "bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80",
        )}
        data-testid="manual-preview-dock"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <LedStripPreview
            mode={mode}
            brightnessPercent={brightnessPercent}
            rgb={
              mode === "solid"
                ? rgb
                : effect.r !== undefined &&
                    effect.g !== undefined &&
                    effect.b !== undefined
                  ? { r: effect.r, g: effect.g, b: effect.b }
                  : rgb
            }
            effectId={effect.effectId}
            gateId={
              isAllGates ? "All gates" : selectedGateId || undefined
            }
            data-testid="led-strip-preview"
          />
        </div>
      </div>
    </>
  );
}
