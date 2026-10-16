"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FADE_MS = 10_000;

const PRESETS = [
  { label: "Off", ms: 0 },
  { label: "0.25s", ms: 250 },
  { label: "0.5s", ms: 500 },
  { label: "1s", ms: 1000 },
  { label: "2s", ms: 2000 },
] as const;

type FadeControlProps = {
  value: number;
  onChange: (fadeMs: number) => void;
};

function secondsLabel(fadeMs: number): string {
  const seconds = fadeMs / 1000;
  if (Number.isInteger(seconds)) return String(seconds);
  return String(Number(seconds.toFixed(2)));
}

export function FadeControl({ value, onChange }: FadeControlProps) {
  const [draft, setDraft] = useState(() => secondsLabel(value));

  useEffect(() => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && Math.round(parsed * 1000) === value) return;
    setDraft(secondsLabel(value));
  }, [value, draft]);

  return (
    <div className="space-y-2">
      <Label htmlFor="fade-seconds">Fade</Label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.ms}
            type="button"
            size="sm"
            variant={value === preset.ms ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={value === preset.ms}
            onClick={() => {
              onChange(preset.ms);
              setDraft(secondsLabel(preset.ms));
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id="fade-seconds"
          type="number"
          inputMode="decimal"
          min={0}
          max={10}
          step={0.05}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(
              Math.max(0, Math.min(MAX_FADE_MS, Math.round(next * 1000))),
            );
          }}
          aria-label="Fade seconds"
        />
        <span className="shrink-0 text-sm text-muted-foreground">seconds</span>
      </div>
    </div>
  );
}
