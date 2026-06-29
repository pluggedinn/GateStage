"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  removed: string[];
  discovered: { id: string; host: string; source: string }[];
};

export default function GatesPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [scanning, setScanning] = useState(false);

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
      } else if (
        data.added.length === 0 &&
        data.updated.length === 0 &&
        data.removed.length === 0
      ) {
        toast.success("Scan complete", {
          id: toastId,
          description: `${data.discovered.length} gate(s) on the network.`,
        });
      } else {
        const parts: string[] = [];
        if (data.added.length > 0) parts.push(`added ${data.added.join(", ")}`);
        if (data.updated.length > 0) {
          parts.push(`updated ${data.updated.join(", ")}`);
        }
        if (data.removed.length > 0) {
          parts.push(`removed ${data.removed.join(", ")}`);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gates</h1>
          <p className="text-base text-muted-foreground">
            Gates are discovered from ESPHome devices on the race LAN via mDNS.
            The list syncs automatically every 15 seconds.
          </p>
        </div>
        <Button onClick={() => void scanNetwork()} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan network"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discovered gates</CardTitle>
          <CardDescription>
            {gates.length} gate(s) on the network
            {scanning ? " · scanning…" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gates.length === 0 ? (
            <p className="text-base text-muted-foreground">
              No gates on the network. Ensure ESPHome devices are powered on,
              on the same WiFi, and advertising mDNS — then scan.
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
