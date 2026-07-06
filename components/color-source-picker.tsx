"use client";

import { ColorPicker } from "@/components/color-picker";
import { Label } from "@/components/ui/label";
import type { Rgb } from "@/lib/color";
import type { ColorSource } from "@/lib/color-source";
import { cn } from "@/lib/utils";

type ColorSourcePickerProps = {
  colorSource: ColorSource;
  onColorSourceChange: (source: ColorSource) => void;
  rgb: Rgb;
  onRgbChange: (rgb: Rgb) => void;
  /** When false, only custom RGB is available. */
  showPilotOption?: boolean;
  label?: string;
  className?: string;
};

export function ColorSourcePicker({
  colorSource,
  onColorSourceChange,
  rgb,
  onRgbChange,
  showPilotOption = false,
  label = "Color",
  className,
}: ColorSourcePickerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {showPilotOption ? (
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["fixed", "Custom"],
                ["pilot", "Pilot color"],
              ] as const
            ).map(([value, optionLabel]) => (
              <button
                key={value}
                type="button"
                aria-pressed={colorSource === value}
                onClick={() => onColorSourceChange(value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  colorSource === value
                    ? "border-foreground/25 bg-muted font-medium"
                    : "border-border hover:bg-muted/50",
                )}
              >
                {optionLabel}
              </button>
            ))}
          </div>
          {colorSource === "pilot" ? (
            <p className="text-xs text-muted-foreground">
              Uses the pilot&apos;s assigned color when this routine runs.
            </p>
          ) : null}
        </div>
      ) : null}

      {colorSource === "fixed" || !showPilotOption ? (
        <ColorPicker
          label={showPilotOption ? undefined : label}
          value={rgb}
          onChange={onRgbChange}
        />
      ) : null}
    </div>
  );
}
