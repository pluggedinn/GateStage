"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BrightnessControl } from "@/components/brightness-control";
import { ColorPicker } from "@/components/color-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EffectPicker,
  type EffectSelection,
} from "@/components/effect-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventMapping, Gate } from "@/lib/config/schema";
import { rgbToHex } from "@/lib/color";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import { describeEffectAction, defaultEffectParams } from "@/lib/effects";

const EVENT_TYPES = [
  "heat.loaded",
  "heat.arm_started",
  "heat.go",
  "heat.finished",
  "pilot.crossing",
] as const;

const ACTION_KINDS = ["effect", "solid", "pilot_color", "off"] as const;

export default function MappingsPage() {
  const [mappings, setMappings] = useState<EventMapping[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [eventType, setEventType] = useState<string>("heat.go");
  const [target, setTarget] = useState<string>("all");
  const [actionKind, setActionKind] = useState<string>("solid");
  const [effect, setEffect] = useState<EffectSelection>({
    effectId: "pulse",
    params: defaultEffectParams("pulse"),
  });
  const [rgb, setRgb] = useState({ r: 0, g: 255, b: 0 });
  const [brightnessPercent, setBrightnessPercent] = useState(
    DEFAULT_BRIGHTNESS_PERCENT,
  );
  const [mappingToDelete, setMappingToDelete] = useState<string | null>(null);

  const targetItems = useMemo(
    () => [
      { value: "all", label: "All gates" },
      { value: "start_gate", label: "Start gate" },
      ...gates.map((g) => ({ value: `gate:${g.id}`, label: g.id })),
    ],
    [gates],
  );

  const load = useCallback(async () => {
    const [mRes, gRes, sRes] = await Promise.all([
      fetch("/api/mappings"),
      fetch("/api/gates"),
      fetch("/api/settings"),
    ]);
    setMappings(await mRes.json());
    setGates(await gRes.json());
    if (sRes.ok) {
      const settings = (await sRes.json()) as {
        defaultBrightnessPercent?: number;
      };
      if (settings.defaultBrightnessPercent !== undefined) {
        setBrightnessPercent(settings.defaultBrightnessPercent);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function brightnessSuffix(percent?: number) {
    if (percent === undefined) return null;
    return (
      <span className="text-muted-foreground"> @ {percent}%</span>
    );
  }

  function buildAction() {
    if (actionKind === "effect")
      return {
        kind: "effect",
        effectId: effect.effectId,
        params: effect.params,
        brightnessPercent,
      };
    if (actionKind === "solid")
      return { kind: "solid", ...rgb, brightnessPercent };
    if (actionKind === "pilot_color")
      return { kind: "pilot_color", brightnessPercent };
    return { kind: "off" };
  }

  async function addMapping(e: React.FormEvent) {
    e.preventDefault();
    const actualTarget = target.startsWith("gate:") ? "gate_id" : target;
    const targetGateId = target.startsWith("gate:")
      ? target.slice("gate:".length)
      : null;
    const res = await fetch("/api/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        target: actualTarget,
        targetGateId,
        action: buildAction(),
        enabled: true,
      }),
    });
    if (res.ok) {
      toast.success("Mapping added", { description: eventType });
    } else {
      toast.error("Could not add mapping");
    }
    await load();
  }

  async function toggleEnabled(mapping: EventMapping) {
    await fetch(`/api/mappings/${mapping.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !mapping.enabled }),
    });
    await load();
  }

  async function deleteMapping(id: string) {
    await fetch(`/api/mappings/${id}`, { method: "DELETE" });
    toast.success("Mapping removed");
    await load();
  }

  function describeAction(action: EventMapping["action"]) {
    if (action.kind === "effect") {
      const effectId =
        action.effectId ?? action.name ?? "pulse";
      return (
        <>
          {describeEffectAction(effectId, action.params)}
          {brightnessSuffix(action.brightnessPercent)}
        </>
      );
    }
    if (action.kind === "solid")
      return (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-sm border border-border"
            style={{
              backgroundColor: rgbToHex({
                r: action.r,
                g: action.g,
                b: action.b,
              }),
            }}
          />
          {rgbToHex({ r: action.r, g: action.g, b: action.b })}
          {brightnessSuffix(action.brightnessPercent)}
        </span>
      );
    if (action.kind === "pilot_color")
      return <>pilot color{brightnessSuffix(action.brightnessPercent)}</>;
    return "off";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mappings</h1>
        <p className="text-base text-muted-foreground">
          Race event to gate action rules
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={addMapping}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-2">
              <Label>Event</Label>
              <Select value={eventType} onValueChange={(v) => v && setEventType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target</Label>
              <Select
                value={target}
                onValueChange={(v) => v && setTarget(v)}
                items={targetItems}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All gates</SelectItem>
                  <SelectItem value="start_gate">Start gate</SelectItem>
                  {gates.map((g) => (
                    <SelectItem key={g.id} value={`gate:${g.id}`}>
                      {g.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={actionKind} onValueChange={(v) => v && setActionKind(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {actionKind === "effect" && (
              <div className="space-y-2 sm:col-span-2">
                <EffectPicker value={effect} onChange={setEffect} />
              </div>
            )}
            {(actionKind === "effect" ||
              actionKind === "solid" ||
              actionKind === "pilot_color") && (
              <div className="space-y-2 sm:col-span-2">
                <BrightnessControl
                  value={brightnessPercent}
                  onChange={setBrightnessPercent}
                />
              </div>
            )}
            {actionKind === "solid" && (
              <ColorPicker value={rgb} onChange={setRgb} label="Color" />
            )}
            <div className="flex items-end">
              <Button type="submit">Add mapping</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active mappings</CardTitle>
          <CardDescription>{mappings.length} rule(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">
                    {m.eventType}
                  </TableCell>
                  <TableCell>{m.target}</TableCell>
                  <TableCell>{describeAction(m.action)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={() => toggleEnabled(m)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setMappingToDelete(m.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={mappingToDelete !== null}
        onOpenChange={(open) => !open && setMappingToDelete(null)}
        title="Delete mapping?"
        description="This race event rule will be removed. You can add it again later."
        onConfirm={() =>
          mappingToDelete ? deleteMapping(mappingToDelete) : Promise.resolve()
        }
      />
    </div>
  );
}
