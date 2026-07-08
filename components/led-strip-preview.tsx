"use client";

import { EFFECT_CATALOG } from "@/lib/effects";
import { applyBrightnessToRgb, rgbToHex, type Rgb } from "@/lib/color";
import { cn } from "@/lib/utils";

export type LedPreviewMode = "effect" | "solid" | "off";

type LedStripPreviewProps = {
  mode: LedPreviewMode;
  brightnessPercent: number;
  rgb?: Rgb;
  effectId?: string;
  gateId?: string;
  className?: string;
  "data-testid"?: string;
};

function effectAnimationClass(effectId: string): string {
  if (effectId === "addressable_rainbow") {
    return "led-animate-rainbow";
  }
  if (effectId === "pulse") {
    return "led-animate-pulse";
  }
  if (effectId === "strobe") {
    return "led-animate-strobe";
  }
  if (effectId === "addressable_color_wipe") {
    return "led-animate-scan";
  }
  return "led-animate-pulse";
}

function effectBackgroundStyle(
  effectId: string,
  brightnessPercent: number,
  rgb: Rgb,
): React.CSSProperties {
  if (effectId === "addressable_rainbow") {
    return {
      backgroundImage:
        "linear-gradient(90deg, oklch(0.55 0.2 25), oklch(0.55 0.2 85), oklch(0.55 0.2 155), oklch(0.55 0.2 250), oklch(0.55 0.2 25))",
    };
  }
  if (effectId === "addressable_color_wipe") {
    const accent = rgbToHex(applyBrightnessToRgb(rgb, brightnessPercent));
    return {
      backgroundImage: `linear-gradient(90deg, oklch(0.12 0 0) 0%, oklch(0.12 0 0) 40%, ${accent} 50%, oklch(0.12 0 0) 60%, oklch(0.12 0 0) 100%)`,
      backgroundSize: "200% 100%",
    };
  }
  return {
    backgroundColor: rgbToHex(applyBrightnessToRgb(rgb, brightnessPercent)),
  };
}

function effectOpacity(effectId: string, brightnessPercent: number): number {
  if (effectId === "addressable_color_wipe") {
    return 1;
  }
  return Math.max(0.2, brightnessPercent / 100);
}

export function LedStripPreview({
  mode,
  brightnessPercent,
  rgb = { r: 255, g: 0, b: 0 },
  effectId = "pulse",
  gateId,
  className,
  "data-testid": testId,
}: LedStripPreviewProps) {
  const effect = EFFECT_CATALOG.find((e) => e.id === effectId);
  const label =
    mode === "off"
      ? "Off"
      : mode === "solid"
        ? `Solid ${rgbToHex(rgb)} @ ${brightnessPercent}%`
        : effect
          ? `${effect.name} @ ${brightnessPercent}%`
          : "Effect";

  const stripStyle =
    mode === "off"
      ? { backgroundColor: "oklch(0.12 0 0)" }
      : mode === "solid"
        ? {
            backgroundColor: rgbToHex(
              applyBrightnessToRgb(rgb, brightnessPercent),
            ),
          }
        : {
            ...effectBackgroundStyle(effectId, brightnessPercent, rgb),
            opacity: effectOpacity(effectId, brightnessPercent),
          };

  const animationClass =
    mode === "effect" ? effectAnimationClass(effectId) : undefined;

  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      <div
        className="rounded-xl border border-border bg-black/80 p-2"
        role="img"
        aria-label={`LED preview: ${label}${gateId ? ` on ${gateId}` : ""}`}
      >
        <div
          className={cn(
            "h-16 w-full rounded-lg shadow-inner ring-1 ring-white/10 sm:h-20",
            animationClass,
          )}
          style={stripStyle}
        />
        <div className="mt-1.5 flex gap-0.5 px-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full bg-white/10"
              aria-hidden
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        {gateId ? (
          <span className="font-mono tabular-nums">{gateId}</span>
        ) : null}
      </div>
    </div>
  );
}
