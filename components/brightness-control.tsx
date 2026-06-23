"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { percentToEsphome } from "@/lib/brightness";
import { cn } from "@/lib/utils";

type BrightnessControlProps = {
  value: number;
  onChange: (percent: number) => void;
  onSaveDefault?: () => void;
  savingDefault?: boolean;
  /** Taller slider for race-day / tablet use (Manual page). */
  large?: boolean;
};

export function BrightnessControl({
  value,
  onChange,
  onSaveDefault,
  savingDefault,
  large,
}: BrightnessControlProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="brightness" className={large ? "text-base" : undefined}>
          Brightness
        </Label>
        <span className="text-base tabular-nums text-muted-foreground">
          {value}% ({percentToEsphome(value)}/255)
        </span>
      </div>
      <input
        id="brightness"
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-full cursor-pointer accent-primary",
          large ? "h-3 min-h-[44px] appearance-none py-4" : "h-2",
        )}
      />
      {onSaveDefault && (
        <Button
          type="button"
          variant="outline"
          size={large ? "lg" : "sm"}
          className={large ? "min-h-11" : undefined}
          disabled={savingDefault}
          onClick={onSaveDefault}
        >
          Save as race default
        </Button>
      )}
    </div>
  );
}
