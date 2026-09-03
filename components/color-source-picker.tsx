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
  showWinnerOption?: boolean;
  label?: string;
  className?: string;
};

export function ColorSourcePicker({
  colorSource,
  onColorSourceChange,
  rgb,
  onRgbChange,
  showPilotOption = false,
  showWinnerOption = false,
  label = "Color",
  className,
}: ColorSourcePickerProps) {
  const options: { value: ColorSource; label: string }[] = [
    { value: "fixed", label: "Custom" },
  ];
  if (showPilotOption) {
    options.push({ value: "pilot", label: "Pilot color" });
  }
  if (showWinnerOption) {
    options.push({ value: "winner", label: "Winner color" });
  }
  const showSourceToggle = showPilotOption || showWinnerOption;

  return (
    <div className={cn("space-y-3", className)}>
      {showSourceToggle ? (
        <div className="space-y-2">
          <Label>{label}</Label>
          <div
            className={cn(
              "grid gap-2",
              options.length > 2 ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {options.map(({ value, label: optionLabel }) => (
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
          {colorSource === "winner" ? (
            <p className="text-xs text-muted-foreground">
              First pilot to complete 3 laps this heat.
            </p>
          ) : null}
        </div>
      ) : null}

      {colorSource === "fixed" || !showSourceToggle ? (
        <ColorPicker
          label={showSourceToggle ? undefined : label}
          value={rgb}
          onChange={onRgbChange}
        />
      ) : null}
    </div>
  );
}
