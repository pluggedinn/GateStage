"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BrightnessControl } from "@/components/brightness-control";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import type { Settings } from "@/lib/config/schema";

export default function SettingsPage() {
  const [nextWsUrl, setNextWsUrl] = useState("");
  const [brightnessPercent, setBrightnessPercent] = useState(
    DEFAULT_BRIGHTNESS_PERCENT,
  );
  const [loading, setLoading] = useState(true);
  const [savingBrightness, setSavingBrightness] = useState(false);
  const [savingNextUrl, setSavingNextUrl] = useState(false);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = (await res.json()) as Settings;
    setNextWsUrl(data.nextWsUrl);
    setBrightnessPercent(data.defaultBrightnessPercent);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function patchSettings(
    body: Partial<Settings>,
    onSuccess: () => void,
    onError: () => void,
  ) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onSuccess();
    } else {
      onError();
    }
  }

  async function saveDefaultBrightness() {
    setSavingBrightness(true);
    try {
      await patchSettings(
        { defaultBrightnessPercent: brightnessPercent },
        () =>
          toast.success("Default brightness saved", {
            description: `${brightnessPercent}% for automated mappings and manual defaults`,
          }),
        () => toast.error("Could not save default brightness"),
      );
    } finally {
      setSavingBrightness(false);
    }
  }

  async function saveNextWsUrl() {
    setSavingNextUrl(true);
    try {
      await patchSettings(
        { nextWsUrl: nextWsUrl.trim() },
        () =>
          toast.success("Next WebSocket URL saved", {
            description: nextWsUrl.trim(),
          }),
        () => toast.error("Could not save Next WebSocket URL"),
      );
    } finally {
      setSavingNextUrl(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-base text-muted-foreground">
          Global defaults for GateStage and the Next race director connection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default brightness</CardTitle>
          <CardDescription>
            Used for new mappings and as the starting value on the Manual page.
            ESPHome sends 0–255; 5% is typical for 12V strips on race day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrightnessControl
            value={brightnessPercent}
            onChange={setBrightnessPercent}
            onSaveDefault={saveDefaultBrightness}
            savingDefault={savingBrightness || loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next WebSocket URL</CardTitle>
          <CardDescription>
            Where GateStage listens for race events from the Next desktop app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="next-ws-url">WebSocket URL</Label>
            <Input
              id="next-ws-url"
              value={nextWsUrl}
              onChange={(e) => setNextWsUrl(e.target.value)}
              placeholder="ws://127.0.0.1:9400"
              className="font-mono"
              disabled={loading}
            />
          </div>
          <Button
            type="button"
            disabled={savingNextUrl || loading || !nextWsUrl.trim()}
            onClick={() => void saveNextWsUrl()}
          >
            Save URL
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
