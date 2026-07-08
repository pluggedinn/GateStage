"use client";

import type { Gate } from "@/lib/config/schema";
import { cn } from "@/lib/utils";

export type GateTargetExtraOption = {
  value: string;
  label: string;
  title?: string;
  disabled?: boolean;
};

type GateTargetPickerProps = {
  gates: Gate[];
  value: string;
  onChange: (value: string) => void;
  extraOptions?: GateTargetExtraOption[];
  getGateValue?: (gate: Gate) => string;
  ariaLabel?: string;
  className?: string;
};

function GatePillLabel({
  order,
  id,
  selected,
}: {
  order: number;
  id: string;
  selected: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 font-mono tabular-nums">
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          selected
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {order}
      </span>
      {id}
    </span>
  );
}

function pillButtonClass(selected: boolean, disabled?: boolean) {
  return cn(
    "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background hover:bg-muted",
    disabled && "cursor-not-allowed opacity-50",
  );
}

export function GateTargetPicker({
  gates,
  value,
  onChange,
  extraOptions = [],
  getGateValue = (gate) => gate.id,
  ariaLabel = "Select gate",
  className,
}: GateTargetPickerProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {extraOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          disabled={option.disabled}
          className={pillButtonClass(value === option.value, option.disabled)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
      {gates.map((gate, index) => {
        const gateValue = getGateValue(gate);
        const selected = value === gateValue;
        return (
          <button
            key={gate.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={gate.host}
            className={cn(
              pillButtonClass(selected),
              !gate.enabled && "opacity-60",
            )}
            onClick={() => onChange(gateValue)}
          >
            <GatePillLabel order={index + 1} id={gate.id} selected={selected} />
          </button>
        );
      })}
    </div>
  );
}
