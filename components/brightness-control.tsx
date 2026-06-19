"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { percentToEsphome } from "@/lib/brightness";

type BrightnessControlProps = {
  value: number;
  onChange: (percent: number) => void;
  onSaveDefault?: () => void;
  savingDefault?: boolean;
};

export function BrightnessControl({
  value,
  onChange,
  onSaveDefault,
  savingDefault,
}: BrightnessControlProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="brightness">Brightness</Label>
        <span className="text-sm tabular-nums text-muted-foreground">
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
        className="h-2 w-full cursor-pointer accent-primary"
      />
      {onSaveDefault && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={savingDefault}
          onClick={onSaveDefault}
        >
          Save as race default
        </Button>
      )}
    </div>
  );
}
