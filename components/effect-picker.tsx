"use client";

import { useMemo } from "react";
import {
  EFFECT_CATALOG,
  defaultEffectParams,
  mergeEffectParams,
} from "@/lib/effects";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type EffectSelection = {
  effectId: string;
  params: Record<string, number | boolean>;
};

type EffectPickerProps = {
  value: EffectSelection;
  onChange: (value: EffectSelection) => void;
  className?: string;
  /** Side-by-side effect select and parameters on wide screens. */
  layout?: "stacked" | "inline";
};

const BASIC_EFFECTS = EFFECT_CATALOG.filter((e) => e.category === "basic");
const STRIP_EFFECTS = EFFECT_CATALOG.filter((e) => e.category === "strip");

const EFFECT_ITEM_GROUPS = [
  {
    label: "Basic",
    items: BASIC_EFFECTS.map((e) => ({ value: e.id, label: e.name })),
  },
  {
    label: "Strip",
    items: STRIP_EFFECTS.map((e) => ({ value: e.id, label: e.name })),
  },
] as const;

export function EffectPicker({
  value,
  onChange,
  className,
  layout = "stacked",
}: EffectPickerProps) {
  const effect = EFFECT_CATALOG.find((e) => e.id === value.effectId);
  const mergedParams = useMemo(
    () => mergeEffectParams(value.effectId, value.params),
    [value.effectId, value.params],
  );

  function setEffectId(effectId: string) {
    onChange({ effectId, params: defaultEffectParams(effectId) });
  }

  function setParam(key: string, next: number | boolean) {
    onChange({
      effectId: value.effectId,
      params: { ...value.params, [key]: next },
    });
  }

  const effectSelect = (
    <div className="space-y-2">
      <Label>Effect</Label>
      <Select
        value={value.effectId}
        onValueChange={(v) => v && setEffectId(v)}
        items={EFFECT_ITEM_GROUPS}
      >
        <SelectTrigger className={layout === "inline" ? "w-full" : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Basic</SelectLabel>
            {BASIC_EFFECTS.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Strip</SelectLabel>
            {STRIP_EFFECTS.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {effect ? (
        <p className="text-xs text-muted-foreground">{effect.description}</p>
      ) : null}
    </div>
  );

  const paramsPanel =
    effect && effect.params.length > 0 ? (
      <div
        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <p className="text-xs font-medium text-muted-foreground sm:col-span-2 xl:col-span-3">
          Parameters
        </p>
        {effect.params.map((param) => {
          const current = mergedParams[param.key];
          const yamlNote = param.yamlOnly ? " (gate YAML)" : "";

          if (param.type === "bool") {
            return (
              <div
                key={param.key}
                className="flex items-center justify-between gap-3"
              >
                <Label htmlFor={param.key} className="text-sm font-normal">
                  {param.label}
                  {yamlNote}
                </Label>
                <Switch
                  id={param.key}
                  checked={Boolean(current)}
                  onCheckedChange={(checked) => setParam(param.key, checked)}
                />
              </div>
            );
          }

          return (
            <div key={param.key} className="space-y-1.5">
              <Label htmlFor={param.key} className="text-sm font-normal">
                {param.label}
                {yamlNote}
                {param.type === "milliseconds" && " (ms)"}
                {param.type === "seconds" && " (s)"}
                {param.type === "percent" && " (%)"}
              </Label>
              <Input
                id={param.key}
                type="number"
                min={param.min}
                max={param.max}
                step={param.step ?? 1}
                value={typeof current === "number" ? current : 0}
                onChange={(e) => setParam(param.key, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>
    ) : null;

  if (layout === "inline") {
    return (
      <div
        className={cn(
          "grid min-w-0 gap-4 md:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] md:items-start",
          className,
        )}
      >
        {effectSelect}
        {paramsPanel}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {effectSelect}
      {paramsPanel}
    </div>
  );
}
