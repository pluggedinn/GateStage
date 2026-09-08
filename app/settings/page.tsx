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

type DetectCandidate = {
  url: string;
  source: "scan" | "mdns" | "localhost";
  label: string;
};

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

function applyCandidateUrl(
  provider: IntegrationId,
  url: string,
  setNextWsUrl: (v: string) => void,
  setRotorHazardUrl: (v: string) => void,
) {
  if (provider === "next") setNextWsUrl(url);
  if (provider === "rotorhazard") setRotorHazardUrl(url);
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
  const [detecting, setDetecting] = useState(false);
  const [detectCandidates, setDetectCandidates] = useState<DetectCandidate[]>(
    [],
  );

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

  async function detectRaceManager() {
    if (raceManagerProvider !== "next" && raceManagerProvider !== "rotorhazard") {
      return;
    }

    setDetecting(true);
    const label =
      raceManagerProvider === "next" ? "Next" : "RotorHazard";
    const toastId = toast.loading(`Looking for ${label} on this network…`);

    try {
      const res = await fetch("/api/settings/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: raceManagerProvider }),
      });
      if (!res.ok) {
        toast.error("Detect failed", {
          id: toastId,
          description: "Could not scan the network.",
        });
        return;
      }

      const data = (await res.json()) as {
        candidates?: DetectCandidate[];
      };
      const candidates = data.candidates ?? [];
      setDetectCandidates(candidates);

      if (candidates.length === 0) {
        toast.error(`No ${label} found`, {
          id: toastId,
          description:
            raceManagerProvider === "next"
              ? "Is Next running on this WiFi with its WebSocket on port 5702?"
              : "Is RotorHazard running on this WiFi (port 5000, or rotorhazard.local)?",
        });
        return;
      }

      const top = candidates[0];
      applyCandidateUrl(
        raceManagerProvider,
        top.url,
        setNextWsUrl,
        setRotorHazardUrl,
      );

      toast.success(
        candidates.length === 1 ? `Found ${label}` : `Found ${candidates.length} ${label} hosts`,
        {
          id: toastId,
          description:
            candidates.length === 1
              ? top.url
              : `${top.url} — pick another below if needed, then Save.`,
        },
      );
    } catch {
      toast.error("Detect failed", {
        id: toastId,
        description: "Could not scan the network.",
      });
    } finally {
      setDetecting(false);
    }
  }

  function selectCandidate(candidate: DetectCandidate) {
    applyCandidateUrl(
      raceManagerProvider,
      candidate.url,
      setNextWsUrl,
      setRotorHazardUrl,
    );
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
              onValueChange={(value) => {
                setRaceManagerProvider(value as IntegrationId);
                setDetectCandidates([]);
              }}
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
                  placeholder="ws://192.168.1.50:5702"
                  className="font-mono"
                  disabled={loading}
                />
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

          {detectCandidates.length > 1 && (
            <div className="space-y-2" data-testid="detect-candidates">
              <p className="text-sm text-muted-foreground">
                Other matches — click to use, then Save:
              </p>
              <ul className="flex flex-col gap-2">
                {detectCandidates.map((candidate) => (
                  <li key={candidate.url}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => selectCandidate(candidate)}
                    >
                      <span className="font-mono tabular-nums">
                        {candidate.url}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {candidate.label} · {candidate.source}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {providerIsAvailable && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={detecting || loading || savingConnection}
                onClick={() => void detectRaceManager()}
                data-testid="detect-race-manager"
              >
                {detecting ? "Detecting…" : "Detect"}
              </Button>
              <Button
                type="button"
                disabled={
                  savingConnection ||
                  detecting ||
                  loading ||
                  connectionUrl.length === 0
                }
                onClick={() => void saveConnection()}
              >
                Save
              </Button>
            </div>
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
