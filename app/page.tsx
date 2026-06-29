"use client";

import { useEffect, useState } from "react";
import { StatusStrip } from "@/components/dashboard/status-strip";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRaceSocket } from "@/hooks/use-race-socket";
import { parseRgbFromCommand, rgbToHex } from "@/lib/color";
import {
  eventStatusBorderClass,
  eventStatusTextClass,
} from "@/lib/event-status";
import type { Gate } from "@/lib/config/schema";
import type { RaceActionEnvelope, RaceEventEnvelope } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatEventTime(at: string) {
  return new Date(at).toLocaleTimeString();
}

function EventHero({ event }: { event: RaceEventEnvelope }) {
  return (
    <div
      className={cn(
        "mb-4 rounded-lg border border-border border-l-4 bg-muted/40 p-4",
        eventStatusBorderClass(event.type),
      )}
    >
      <p className="text-sm text-muted-foreground">Latest event</p>
      <p
        data-testid="latest-event-type"
        className={cn(
          "mt-1 font-mono text-xl font-medium",
          eventStatusTextClass(event.type),
        )}
      >
        {event.type}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
        {formatEventTime(event.at)}
      </p>
    </div>
  );
}

function EventRow({
  event,
  dense,
}: {
  event: RaceEventEnvelope;
  dense?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-md border border-border bg-muted/30",
        dense ? "p-2 text-sm" : "p-3 text-base",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-mono", eventStatusTextClass(event.type))}>
          {event.type}
        </span>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {formatEventTime(event.at)}
        </span>
      </div>
    </li>
  );
}

function ActionSwatch({ command }: { command: string }) {
  const rgb = parseRgbFromCommand(command);
  if (!rgb) return null;
  return (
    <span
      className="size-4 shrink-0 rounded border border-border"
      style={{ backgroundColor: rgbToHex(rgb) }}
      aria-hidden
    />
  );
}

function ActionHero({ action }: { action: RaceActionEnvelope }) {
  return (
    <div className="mb-4 rounded-lg border border-border border-l-4 border-l-border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">Latest command</p>
      <div className="mt-2 flex items-center gap-3">
        <ActionSwatch command={action.command} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xl font-medium">
            {action.gateId}
          </p>
          <p className="truncate font-mono text-sm text-muted-foreground">
            {action.command}
          </p>
        </div>
        <Badge variant={action.success ? "default" : "destructive"}>
          {action.success ? "ok" : "fail"}
        </Badge>
      </div>
      {action.error && (
        <p className="mt-2 text-sm text-destructive">{action.error}</p>
      )}
    </div>
  );
}

function ActionRow({
  action,
  dense,
}: {
  action: RaceActionEnvelope;
  dense?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-md border border-border bg-muted/30",
        dense ? "p-2 text-sm" : "p-3 text-base",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ActionSwatch command={action.command} />
          <span className="truncate font-mono">{action.gateId}</span>
        </div>
        <span className="hidden truncate font-mono text-muted-foreground sm:inline">
          {action.command}
        </span>
        <Badge variant={action.success ? "default" : "destructive"}>
          {action.success ? "ok" : "fail"}
        </Badge>
      </div>
      {action.error && (
        <p className="mt-1 text-sm text-destructive">{action.error}</p>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const { events, actions } = useRaceSocket();
  const [enabledGateCount, setEnabledGateCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/gates");
      if (!res.ok || cancelled) return;
      const gates = (await res.json()) as Gate[];
      if (!cancelled) {
        setEnabledGateCount(gates.filter((g) => g.enabled).length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [latestEvent, ...olderEvents] = events;
  const [latestAction, ...olderActions] = actions;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-base text-muted-foreground">
          Live race events and gate actions
        </p>
      </div>

      <StatusStrip
        enabledGateCount={enabledGateCount}
        lastEvent={latestEvent}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Race events</CardTitle>
            <CardDescription>
              From Next race director (mock or real)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 pr-4">
              {events.length === 0 ? (
                <p className="text-base text-muted-foreground">
                  No events yet. Run{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                    npm run dev:mocks
                  </code>{" "}
                  and emit via mock Next HTTP API.
                </p>
              ) : (
                <>
                  <EventHero event={latestEvent} />
                  {olderEvents.length > 0 && (
                    <ul className="space-y-2">
                      {olderEvents.map((event, i) => (
                        <EventRow
                          key={`${event.at}-${i + 1}`}
                          event={event}
                          dense
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gate actions</CardTitle>
            <CardDescription>Commands sent to ESPHome gates</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 pr-4">
              {actions.length === 0 ? (
                <p className="text-base text-muted-foreground">
                  Gate commands appear here when events trigger routines.
                </p>
              ) : (
                <>
                  <ActionHero action={latestAction} />
                  {olderActions.length > 0 && (
                    <ul className="space-y-2">
                      {olderActions.map((action, i) => (
                        <ActionRow
                          key={`${action.at}-${i + 1}`}
                          action={action}
                          dense
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
