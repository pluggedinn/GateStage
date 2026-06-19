"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Gate } from "@/lib/config/schema";

type DiscoverResult = {
  added: string[];
  updated: string[];
  discovered: { id: string; host: string; source: string }[];
};

export default function GatesPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [gateId, setGateId] = useState("");
  const [host, setHost] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [gateToDelete, setGateToDelete] = useState<string | null>(null);

  const loadGates = useCallback(async () => {
    const res = await fetch("/api/gates");
    setGates(await res.json());
  }, []);

  const scanNetwork = useCallback(async () => {
    setScanning(true);
    const toastId = toast.loading("Scanning network for ESPHome gates…");
    try {
      const res = await fetch("/api/gates/discover", { method: "POST" });
      const data = (await res.json()) as DiscoverResult;
      await loadGates();

      if (data.discovered.length === 0) {
        toast.info("No gates found", {
          id: toastId,
          description: "No ESPHome devices responded on the network.",
        });
      } else if (data.added.length === 0 && data.updated.length === 0) {
        toast.success("Scan complete", {
          id: toastId,
          description: `Found ${data.discovered.length} gate(s); config already up to date.`,
        });
      } else {
        const parts: string[] = [];
        if (data.added.length > 0) parts.push(`added ${data.added.join(", ")}`);
        if (data.updated.length > 0) {
          parts.push(`updated ${data.updated.join(", ")}`);
        }
        toast.success("Scan complete", {
          id: toastId,
          description: parts.join("; "),
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
    void loadGates();
  }, [loadGates]);

  async function addGate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/gates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: gateId, host }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Gate added", { description: `${gateId} @ ${host}` });
      setGateId("");
      setHost("");
      await loadGates();
    } else {
      const data = (await res.json()) as { error?: string };
      toast.error("Could not add gate", {
        description: data.error ?? `HTTP ${res.status}`,
      });
    }
  }

  async function toggleStartGate(gate: Gate) {
    await fetch(`/api/gates/${gate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStartGate: !gate.isStartGate }),
    });
    await loadGates();
  }

  async function toggleEnabled(gate: Gate) {
    await fetch(`/api/gates/${gate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !gate.enabled }),
    });
    await loadGates();
  }

  async function testGate(gateId: string) {
    const res = await fetch(`/api/gates/${gateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = (await res.json()) as { ok: boolean; status?: number };
    if (data.ok) {
      toast.success("Test sent", {
        description: `Rainbow effect on ${gateId}`,
      });
    } else {
      toast.error("Test failed", {
        description: `HTTP ${data.status ?? "error"}`,
      });
    }
  }

  async function pingGate(gateId: string) {
    const res = await fetch(`/api/gates/${gateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ping" }),
    });
    const data = (await res.json()) as { online: boolean };
    if (data.online) {
      toast.success("Gate online", { description: gateId });
    } else {
      toast.error("Gate offline", { description: gateId });
    }
  }

  async function deleteGate(gateId: string) {
    await fetch(`/api/gates/${gateId}`, { method: "DELETE" });
    toast.success("Gate removed", { description: gateId });
    await loadGates();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gates</h1>
          <p className="text-sm text-muted-foreground">
            ESPHome gates are discovered automatically via mDNS on the race LAN.
          </p>
        </div>
        <Button onClick={() => void scanNetwork()} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan network"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured gates</CardTitle>
          <CardDescription>
            {gates.length} gate(s)
            {scanning ? " · scanning…" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No gates yet. Ensure ESPHome devices are on the same WiFi with
              mDNS enabled, or add one manually below.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gates.map((gate) => (
                  <TableRow key={gate.id}>
                    <TableCell className="font-mono font-medium">
                      {gate.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {gate.host}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={gate.isStartGate}
                        onCheckedChange={() => toggleStartGate(gate)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={gate.enabled}
                        onCheckedChange={() => toggleEnabled(gate)}
                      />
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {gate.isStartGate && (
                        <Badge variant="secondary">start</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testGate(gate.id)}
                      >
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pingGate(gate.id)}
                      >
                        Ping
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setGateToDelete(gate.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add gate manually</CardTitle>
          <CardDescription>
            Last resort if mDNS discovery cannot find a device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addGate} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="gate-id">ID</Label>
              <Input
                id="gate-id"
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                placeholder="gate-start"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.4.21"
                required
              />
            </div>
            <Button type="submit" variant="secondary" disabled={loading}>
              Add manually
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={gateToDelete !== null}
        onOpenChange={(open) => !open && setGateToDelete(null)}
        title="Delete gate?"
        description={
          gateToDelete
            ? `Remove ${gateToDelete} from GateStage. The ESPHome device is not affected.`
            : undefined
        }
        onConfirm={() =>
          gateToDelete ? deleteGate(gateToDelete) : Promise.resolve()
        }
      />
    </div>
  );
}
