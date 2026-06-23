"use client";

import { useId, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hexToRgb, rgbToHex, type Rgb } from "@/lib/color";
import { cn } from "@/lib/utils";

type ColorPickerProps = {
  value: Rgb;
  onChange: (value: Rgb) => void;
  label?: string;
  className?: string;
  /** Larger swatch for race-day / tablet use (Manual page). */
  large?: boolean;
  /** Inline toolbar: swatch, hex, and RGB on one row. */
  layout?: "stacked" | "inline";
};

function clampChannel(n: number) {
  return Math.min(255, Math.max(0, Math.round(n)));
}

export function ColorPicker({
  value,
  onChange,
  label,
  className,
  large,
  layout = "stacked",
}: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const hex = rgbToHex(value);

  function setChannel(channel: keyof Rgb, raw: string) {
    const next = Number(raw);
    if (Number.isNaN(next)) return;
    onChange({ ...value, [channel]: clampChannel(next) });
  }

  const swatch = (
    <button
      type="button"
      aria-label={label ? `Pick ${label.toLowerCase()}` : "Pick color"}
      className={cn(
        "shrink-0 cursor-pointer rounded-lg border border-border shadow-sm ring-offset-background transition-shadow hover:ring-2 hover:ring-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        large || layout === "inline" ? "size-11 min-h-11 min-w-11" : "size-10",
      )}
      style={{ backgroundColor: hex }}
      onClick={() => inputRef.current?.click()}
    />
  );

  const hiddenColorInput = (
    <input
      ref={inputRef}
      id={id}
      type="color"
      value={hex}
      className="sr-only"
      onChange={(e) => onChange(hexToRgb(e.target.value))}
    />
  );

  if (layout === "inline") {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2",
          className,
        )}
      >
        {label ? (
          <Label htmlFor={id} className="shrink-0 text-sm">
            {label}
          </Label>
        ) : null}
        {swatch}
        {hiddenColorInput}
        <span className="w-20 shrink-0 font-mono text-sm text-muted-foreground">
          {hex}
        </span>
        {(["r", "g", "b"] as const).map((channel) => (
          <div key={channel} className="flex items-center gap-1.5">
            <Label
              htmlFor={`${id}-${channel}`}
              className="text-xs font-medium uppercase text-muted-foreground"
            >
              {channel}
            </Label>
            <Input
              id={`${id}-${channel}`}
              type="number"
              min={0}
              max={255}
              value={value[channel]}
              onChange={(e) => setChannel(channel, e.target.value)}
              className="h-9 w-[4.25rem] px-2 font-mono tabular-nums"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={id} className={large ? "text-base" : undefined}>
          {label}
        </Label>
      ) : null}
      <div className="flex items-center gap-3">
        {swatch}
        {hiddenColorInput}
        <span
          className={cn(
            "font-mono text-muted-foreground",
            large ? "text-base" : "text-sm",
          )}
        >
          {hex}
        </span>
      </div>
    </div>
  );
}
