"use client";

import { useId, useRef } from "react";
import { Label } from "@/components/ui/label";
import { hexToRgb, rgbToHex, type Rgb } from "@/lib/color";
import { cn } from "@/lib/utils";

type ColorPickerProps = {
  value: Rgb;
  onChange: (value: Rgb) => void;
  label?: string;
  className?: string;
};

export function ColorPicker({
  value,
  onChange,
  label,
  className,
}: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const hex = rgbToHex(value);

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={label ? `Pick ${label.toLowerCase()}` : "Pick color"}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-border shadow-sm ring-offset-background transition-shadow hover:ring-2 hover:ring-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: hex }}
          onClick={() => inputRef.current?.click()}
        />
        <input
          ref={inputRef}
          id={id}
          type="color"
          value={hex}
          className="sr-only"
          onChange={(e) => onChange(hexToRgb(e.target.value))}
        />
        <span className="font-mono text-sm text-muted-foreground">{hex}</span>
      </div>
    </div>
  );
}
