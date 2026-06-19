"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BrightnessControl } from "@/components/brightness-control";
import { ColorPicker } from "@/components/color-picker";
import {
  EffectPicker,
  type EffectSelection,
} from "@/components/effect-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import { defaultEffectParams } from "@/lib/effects";
import type { Gate } from "@/lib/config/schema";

export default function ManualPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string>("");
  const [brightnessPercent, setBrightnessPercent] = useState(
    DEFAULT_BRIGHTNESS_PERCENT,
  );
  const [savingDefault, setSavingDefault] = useState(false);
  const [effect, setEffect] = useState<EffectSelection>({
    effectId: "addressable_rainbow",
    params: defaultEffectParams("addressable_rainbow"),
  });
  const [rgb, setRgb] = useState({ r: 255, g: 0, b: 0 });

  const loadGates = useCallback(async () => {
    const res = await fetch("/api/gates");
    const data = (await res.json()) as Gate[];
    setGates(data);
    if (data[0] && !selectedGateId) setSelectedGateId(data[0].id);
  }, [selectedGateId]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = (await res.json()) as { defaultBrightnessPercent?: number };
    if (data.defaultBrightnessPercent !== undefined) {
      setBrightnessPercent(data.defaultBrightnessPercent);
    }
  }, []);

  useEffect(() => {
    void loadGates();
    void loadSettings();
  }, [loadGates, loadSettings]);

  async function send(command: Record<string, unknown>) {
    if (!selectedGateId) return;
    const res = await fetch(`/api/manual/${selectedGateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const data = (await res.json()) as { ok: boolean; status?: number };
    if (data.ok) {
      toast.success("Command sent", {
        description: `Gate ${selectedGateId}`,
      });
    } else {
      toast.error("Command failed", {
        description: `HTTP ${data.status ?? "error"}`,
      });
    }
  }

  async function saveDefaultBrightness() {
    setSavingDefault(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultBrightnessPercent: brightnessPercent }),
      });
      if (res.ok) {
        toast.success("Default brightness saved", {
          description: `${brightnessPercent}% for all automated mappings`,
        });
      } else {
        toast.error("Could not save default brightness");
      }
    } finally {
      setSavingDefault(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manual control</h1>
        <p className="text-sm text-muted-foreground">
          Override gate LEDs during race day
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gate</CardTitle>
          <CardDescription>Select a gate to control</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedGateId}
            onValueChange={(v) => v && setSelectedGateId(v)}
          >
            <SelectTrigger className="w-fit min-w-56 max-w-md *:data-[slot=select-value]:line-clamp-none">
              <SelectValue placeholder="Select gate" />
            </SelectTrigger>
            <SelectContent className="max-w-md">
              {gates.map((g) => (
                <SelectItem key={g.id} value={g.id} className="font-mono">
                  {g.id} ({g.host})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brightness</CardTitle>
          <CardDescription>
            ESPHome sends 0–255; 5% is typical for 12V strips on race day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrightnessControl
            value={brightnessPercent}
            onChange={setBrightnessPercent}
            onSaveDefault={saveDefaultBrightness}
            savingDefault={savingDefault}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Effect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EffectPicker value={effect} onChange={setEffect} />
            <Button
              className="w-full sm:w-auto"
              onClick={() =>
                send({
                  kind: "effect",
                  effectId: effect.effectId,
                  params: effect.params,
                  brightnessPercent,
                })
              }
            >
              Run effect
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Solid color</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorPicker value={rgb} onChange={setRgb} label="Color" />
            <Button
              className="w-full"
              onClick={() =>
                send({ kind: "rgb", ...rgb, brightnessPercent })
              }
            >
              Set color
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Off</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => send({ kind: "off" })}
            >
              Turn off
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
