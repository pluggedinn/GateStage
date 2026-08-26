"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GatesSortableTable } from "@/components/gates-sortable-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRaceSocket } from "@/hooks/use-race-socket";
import { emptyGateHealth, type GateView } from "@/lib/gate-health";

type DiscoverResult = {
  added: string[];
  updated: string[];
  removed: string[];
  discovered: { id: string; host: string; source: string }[];
};

function asGateView(raw: unknown): GateView | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<GateView>;
  if (typeof g.id !== "string" || typeof g.host !== "string") return null;
  return {
    id: g.id,
    host: g.host,
    isStartGate: Boolean(g.isStartGate),
    enabled: g.enabled !== false,
    sortOrder: typeof g.sortOrder === "number" ? g.sortOrder : 0,
    online: Boolean(g.online),
    lastSeenAt: g.lastSeenAt ?? null,
    rssi: typeof g.rssi === "number" ? g.rssi : null,
    tempC: typeof g.tempC === "number" ? g.tempC : null,
  };
}

export default function GatesPage() {
  const { healthById, configRevision } = useRaceSocket();
  const [gates, setGates] = useState<GateView[]>([]);
  const [scanning, setScanning] = useState(false);
  const [forgetGate, setForgetGate] = useState<GateView | null>(null);

  const loadGates = useCallback(async () => {
    const res = await fetch("/api/gates");
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return;
    setGates(data.map(asGateView).filter((g): g is GateView => g !== null));
  }, []);

  const scanNetwork = useCallback(async () => {
    setScanning(true);
    const toastId = toast.loading("Asking gates to announce…");
    try {
      const res = await fetch("/api/gates/discover", { method: "POST" });
      const data = (await res.json()) as DiscoverResult;
      await loadGates();

      if (
        data.added.length === 0 &&
        data.updated.length === 0 &&
        data.discovered.length === 0
      ) {
        toast.success("Scan complete", {
          id: toastId,
          description:
            "Pinged known gates. New flashed gates appear from beacons.",
        });
      } else {
        const parts: string[] = [];
        if (data.added.length > 0) parts.push(`added ${data.added.join(", ")}`);
        if (data.updated.length > 0) {
          parts.push(`updated ${data.updated.join(", ")}`);
        }
        toast.success("Scan complete", {
          id: toastId,
          description:
            parts.join("; ") || `${data.discovered.length} gate(s) announced.`,
        });
      }
    } catch {
      toast.error("Scan failed", {
        id: toastId,
        description: "Could not complete network discovery.",
      });
    } finally {
      setScanning(false);
    }
  }, [loadGates]);

  useEffect(() => {
    void configRevision;
    void loadGates();
  }, [loadGates, configRevision]);

  const rows = useMemo(
    () =>
      gates.map((gate) => ({
        ...emptyGateHealth(),
        ...gate,
        ...healthById[gate.id],
      })),
    [gates, healthById],
  );

  async function toggleStartGate(gate: GateView) {
    await fetch(`/api/gates/${gate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStartGate: !gate.isStartGate }),
    });
    await loadGates();
  }

  async function toggleEnabled(gate: GateView) {
    await fetch(`/api/gates/${gate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !gate.enabled }),
    });
    await loadGates();
  }

  async function pingGate(gateId: string) {
    const res = await fetch(`/api/gates/${gateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ping" }),
    });
    const data = (await res.json()) as { online?: boolean };
    if (data.online) {
      toast.success("Gate online", { description: gateId });
    } else {
      toast.error("Gate offline", { description: gateId });
    }
  }

  async function confirmForget() {
    if (!forgetGate) return;
    const id = forgetGate.id;
    const res = await fetch(`/api/gates/${id}`, { method: "DELETE" });
    setForgetGate(null);
    if (!res.ok) {
      toast.error("Could not forget gate", { description: id });
      return;
    }
    toast.success(`Forgot ${id}`, {
      description:
        "If it is still on the LAN, the next beacon will add it back.",
    });
    await loadGates();
  }

  async function reorderGates(orderedIds: string[]) {
    const previous = gates;
    const byId = new Map(previous.map((g) => [g.id, g]));
    const optimistic = orderedIds
      .map((id) => byId.get(id))
      .filter((g): g is GateView => g !== undefined);
    setGates(optimistic);

    const res = await fetch("/api/gates/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      setGates(previous);
      const data = (await res.json()) as { error?: string };
      toast.error("Could not save gate order", {
        description: data.error ?? "Unknown error",
      });
      return;
    }

    await loadGates();
  }

  const onlineCount = rows.filter((g) => g.online).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gates</h1>
          <p className="text-base text-muted-foreground">
            The fleet is remembered. Flashed gates announce themselves over UDP;
            Scan Now asks them to speak and pings last-known IPs. A WiFi blip
            marks a row offline — it does not remove it or move start.
          </p>
        </div>
        <Button onClick={() => void scanNetwork()} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan now"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Known gates</CardTitle>
          <CardDescription>
            {gates.length} remembered · {onlineCount} online
            {scanning ? " · scanning…" : ""}
            {gates.length > 1 ? " · drag rows to set track order" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gates.length === 0 ? (
            <p className="text-base text-muted-foreground">
              No gates in the list yet. Power flashed GateStage firmware on the
              race WiFi — they appear from UDP beacons — or Scan Now if you use
              mock/env discovery.
            </p>
          ) : (
            <GatesSortableTable
              gates={rows}
              onReorder={(orderedIds) => void reorderGates(orderedIds)}
              onToggleStartGate={toggleStartGate}
              onToggleEnabled={toggleEnabled}
              onPingGate={pingGate}
              onForgetGate={setForgetGate}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={forgetGate !== null}
        onOpenChange={(open) => {
          if (!open) setForgetGate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget {forgetGate?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes this gate from the list. Start gate, order, and enabled
              are forgotten with it. If the hardware is still on the network,
              the next beacon will add it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmForget()}>
              Forget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
