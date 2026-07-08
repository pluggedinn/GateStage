"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BrightnessControl } from "@/components/brightness-control";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_BRIGHTNESS_PERCENT } from "@/lib/brightness";
import type { Settings } from "@/lib/config/schema";
import {
  INTEGRATIONS,
  type IntegrationId,
  type IntegrationStatus,
} from "@/lib/integrations";

function integrationStatusLabel(status: IntegrationStatus) {
  return status === "available" ? "Available" : "Work in progress";
}

function connectionUrlForProvider(
  provider: IntegrationId,
  nextWsUrl: string,
  rotorHazardUrl: string,
): string {
  if (provider === "next") return nextWsUrl.trim();
  if (provider === "rotorhazard") return rotorHazardUrl.trim();
  return "";
}

export default function SettingsPage() {
  const [raceManagerProvider, setRaceManagerProvider] =
    useState<IntegrationId>("next");
  const [nextWsUrl, setNextWsUrl] = useState("");
  const [rotorHazardUrl, setRotorHazardUrl] = useState("");
  const [brightnessPercent, setBrightnessPercent] = useState(
    DEFAULT_BRIGHTNESS_PERCENT,
  );
  const [loading, setLoading] = useState(true);
  const [savingBrightness, setSavingBrightness] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);

  const selectedIntegration = INTEGRATIONS.find(
    (integration) => integration.id === raceManagerProvider,
  );
  const providerIsAvailable = selectedIntegration?.status === "available";

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = (await res.json()) as Settings;
    setRaceManagerProvider(data.raceManagerProvider);
    setNextWsUrl(data.nextWsUrl);
    setRotorHazardUrl(data.rotorHazardUrl);
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
      await loadSettings();
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
            description: `${brightnessPercent}% for automated routines and manual defaults`,
          }),
        () => toast.error("Could not save default brightness"),
      );
    } finally {
      setSavingBrightness(false);
    }
  }

  async function saveConnection() {
    setSavingConnection(true);
    try {
      const body: Partial<Settings> = { raceManagerProvider };
      if (raceManagerProvider === "next") {
        body.nextWsUrl = nextWsUrl.trim();
      }
      if (raceManagerProvider === "rotorhazard") {
        body.rotorHazardUrl = rotorHazardUrl.trim();
      }

      await patchSettings(
        body,
        () =>
          toast.success("Race manager connection saved", {
            description: connectionUrlForProvider(
              raceManagerProvider,
              nextWsUrl,
              rotorHazardUrl,
            ),
          }),
        () => toast.error("Could not save race manager connection"),
      );
    } finally {
      setSavingConnection(false);
    }
  }

  const connectionUrl = connectionUrlForProvider(
    raceManagerProvider,
    nextWsUrl,
    rotorHazardUrl,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-base text-muted-foreground">
          Global defaults for GateStage and your race manager connection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Race manager</CardTitle>
          <CardDescription>
            Choose which race management software GateStage listens to for
            events. Saving reconnects immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="race-manager-provider">Provider</Label>
            <Select
              value={raceManagerProvider}
              onValueChange={(value) =>
                setRaceManagerProvider(value as IntegrationId)
              }
              disabled={loading}
            >
              <SelectTrigger id="race-manager-provider" className="w-full">
                <SelectValue placeholder="Select a race manager" />
              </SelectTrigger>
              <SelectContent>
                {INTEGRATIONS.map((integration) => (
                  <SelectItem
                    key={integration.id}
                    value={integration.id}
                    disabled={integration.status === "wip"}
                  >
                    <span className="flex items-center gap-2">
                      <span>{integration.label}</span>
                      <Badge
                        variant={
                          integration.status === "available"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {integrationStatusLabel(integration.status)}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedIntegration && (
            <p className="text-sm text-muted-foreground">
              {selectedIntegration.description}
            </p>
          )}

          {raceManagerProvider === "next" && (
            <div className="space-y-3 border-t border-border pt-4">
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
                <p className="text-sm text-muted-foreground">
                  Where GateStage listens for race events from the Next desktop
                  app
                </p>
              </div>
            </div>
          )}

          {raceManagerProvider === "rotorhazard" && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="rotorhazard-url">Server URL</Label>
                <Input
                  id="rotorhazard-url"
                  value={rotorHazardUrl}
                  onChange={(e) => setRotorHazardUrl(e.target.value)}
                  placeholder="http://rotorhazard.local:5000"
                  className="font-mono"
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  RotorHazard host and port for Socket.io (e.g.{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    http://rotorhazard.local:5000
                  </code>
                  ). Paths like{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    /run
                  </code>{" "}
                  are stripped automatically.
                </p>
              </div>
            </div>
          )}

          {raceManagerProvider === "trackside" && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                FPV Trackside is not connectable yet. Select Next or RotorHazard
                for a working integration.
              </p>
            </div>
          )}

          {providerIsAvailable && (
            <Button
              type="button"
              disabled={
                savingConnection || loading || connectionUrl.length === 0
              }
              onClick={() => void saveConnection()}
            >
              Save
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default brightness</CardTitle>
          <CardDescription>
            Used for new routine steps and as the starting value on the Manual
            page. ESPHome sends 0–255; 5% is typical for 12V strips on race day.
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
    </div>
  );
}
