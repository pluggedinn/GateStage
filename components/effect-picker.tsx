"use client";

import { useMemo } from "react";
import { ColorPicker } from "@/components/color-picker";
import {
  EFFECT_BY_ID,
  EFFECT_CATALOG,
  defaultEffectSelection,
  mergeEffectParams,
  type EffectSelection,
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
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LightEffectPreview } from "@/components/light-effect-preview";
import { EFFECT_PREVIEW_BY_ID } from "@/lib/effect-preview";
import { cn } from "@/lib/utils";

export type { EffectSelection };

type EffectPickerProps = {
  value: EffectSelection;
  onChange: (value: EffectSelection) => void;
  className?: string;
  /** Side-by-side effect select and parameters on wide screens. */
  layout?: "stacked" | "inline";
};

const BASIC_EFFECTS = EFFECT_CATALOG.filter((e) => e.category === "basic");
const STRIP_EFFECTS = EFFECT_CATALOG.filter((e) => e.category === "strip");

function effectPreviewLabel(name: string): string {
  return `Animated preview of the ${name} effect`;
}

function EffectPreview({ effectId, name }: { effectId: string; name: string }) {
  const previewType = EFFECT_PREVIEW_BY_ID[effectId];
  if (!previewType) return null;
  return (
    <LightEffectPreview
      type={previewType}
      label={effectPreviewLabel(name)}
    />
  );
}

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
    const next = defaultEffectSelection(effectId);
    const prev = EFFECT_BY_ID.get(value.effectId);
    const picked = EFFECT_BY_ID.get(effectId);
    if (
      picked?.supportsColor &&
      prev?.supportsColor &&
      value.r !== undefined &&
      value.g !== undefined &&
      value.b !== undefined
    ) {
      next.r = value.r;
      next.g = value.g;
      next.b = value.b;
    }
    onChange(next);
  }

  function setParam(key: string, next: number | boolean) {
    onChange({
      ...value,
      params: { ...value.params, [key]: next },
    });
  }

  const effectSelect = (
    <div className="space-y-2">
      <Label>Effect</Label>
      <Select
        value={value.effectId}
        onValueChange={(v) => v && setEffectId(v)}
      >
        <SelectTrigger className={layout === "inline" ? "w-full" : "min-w-48"}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {effect ? (
              <EffectPreview effectId={effect.id} name={effect.name} />
            ) : null}
            <span className="truncate">
              {effect?.name ?? "Select effect"}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent className="min-w-(--anchor-width) w-max max-w-none">
          <SelectGroup>
            <SelectLabel>Basic</SelectLabel>
            {BASIC_EFFECTS.map((e) => (
              <SelectItem key={e.id} value={e.id} className="py-2">
                <EffectPreview effectId={e.id} name={e.name} />
                <span>{e.name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Strip</SelectLabel>
            {STRIP_EFFECTS.map((e) => (
              <SelectItem key={e.id} value={e.id} className="py-2">
                <EffectPreview effectId={e.id} name={e.name} />
                <span>{e.name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {effect ? (
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
          <EffectPreview effectId={effect.id} name={effect.name} />
          <p className="min-w-0 pt-0.5 text-xs text-muted-foreground">
            {effect.description}
          </p>
        </div>
      ) : null}
    </div>
  );

  const colorPanel =
    effect?.supportsColor &&
    value.r !== undefined &&
    value.g !== undefined &&
    value.b !== undefined ? (
      <ColorPicker
        label="Color"
        value={{ r: value.r, g: value.g, b: value.b }}
        onChange={(rgb) => onChange({ ...value, ...rgb })}
      />
    ) : null;

  const paramsPanel =
    effect && effect.params.length > 0 ? (
      <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
        <p className="text-xs font-medium text-muted-foreground sm:col-span-2 xl:col-span-3">
          Parameters
        </p>
        {effect.params.map((param) => {
          const current = mergedParams[param.key];

          if (param.type === "bool") {
            return (
              <div
                key={param.key}
                className="flex items-center justify-between gap-3"
              >
                <Label htmlFor={param.key} className="text-sm font-normal">
                  {param.label}
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
        <div className="space-y-4">
          {colorPanel}
          {paramsPanel}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {effectSelect}
      {colorPanel}
      {paramsPanel}
    </div>
  );
}
