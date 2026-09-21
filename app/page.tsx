"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useRaceSocket } from "@/hooks/use-race-socket";
import { rgbToHex } from "@/lib/color";
import type { Gate } from "@/lib/config/schema";
import {
  type DashboardIssue,
  dashboardIssues,
  eventIssueLabel,
  eventsNewestFirst,
  type GateAttention,
  timelineDetail,
  timelinePilotColor,
  timelineTitle,
} from "@/lib/dashboard-glance";
import { eventStatusTextClass } from "@/lib/event-status";
import { NO_ROUTINE_COMMAND, NOTHING_SENT_COMMAND } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatEventTime(at: string) {
  return new Date(at).toLocaleTimeString();
}

function isGate(value: unknown): value is Gate {
  if (!value || typeof value !== "object") return false;
  const gate = value as Partial<Gate>;
  return typeof gate.id === "string" && typeof gate.host === "string";
}

function issueClass(tone: DashboardIssue["tone"]) {
  return tone === "error" ? "text-status-error" : "text-status-warn";
}

export default function DashboardPage() {
  const { events, actions, healthById, healthReady, configRevision } =
    useRaceSocket();
  const [gates, setGates] = useState<Gate[]>([]);

  useEffect(() => {
    let cancelled = false;
    void configRevision;
    void (async () => {
      const res = await fetch("/api/gates");
      if (!res.ok || cancelled) return;
      const data: unknown = await res.json();
      if (!cancelled && Array.isArray(data)) {
        setGates(data.filter(isGate));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configRevision]);

  const attention: GateAttention[] = healthReady
    ? gates.map((gate) => {
        const health = healthById[gate.id];
        return {
          id: gate.id,
          enabled: gate.enabled !== false,
          online: health?.online ?? false,
          rssi: health?.rssi ?? null,
          tempC: health?.tempC ?? null,
        };
      })
    : [];

  const issues = dashboardIssues(events, actions, attention);
  const feed = eventsNewestFirst(events);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-base text-muted-foreground">
          Race events, and anything that needs a look
        </p>
      </div>

      <section aria-label="Issues" className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Issues</h2>
        {issues.length === 0 ? (
          <p className="text-base text-muted-foreground">No issues.</p>
        ) : (
          <ul data-testid="issues" className="space-y-2">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate font-medium",
                      issueClass(issue.tone),
                    )}
                  >
                    {issue.title}
                  </p>
                  {issue.detail ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {issue.detail}
                    </p>
                  ) : null}
                </div>
                {issue.at ? (
                  <time className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                    {formatEventTime(issue.at)}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Events" className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Events</h2>
        {feed.length === 0 ? (
          <p className="text-base text-muted-foreground">
            Waiting for the race manager.
          </p>
        ) : (
          <ul
            data-testid="event-list"
            className="max-h-96 space-y-2 overflow-y-auto pr-1"
          >
            {feed.map((event) => {
              const color = timelinePilotColor(event);
              const detail = timelineDetail(event);
              const issue = eventIssueLabel(event, actions);
              const warn =
                issue === NO_ROUTINE_COMMAND || issue === NOTHING_SENT_COMMAND;
              return (
                <li
                  key={event.at}
                  className="rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {color ? (
                          <span
                            className="size-3 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: rgbToHex(color) }}
                            aria-hidden
                          />
                        ) : null}
                        <span
                          data-testid="event-title"
                          className={cn(
                            "font-medium",
                            eventStatusTextClass(event.type),
                          )}
                        >
                          {timelineTitle(event)}
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">
                          {event.type}
                        </span>
                        {issue ? (
                          <Badge variant={warn ? "outline" : "destructive"}>
                            {issue}
                          </Badge>
                        ) : null}
                      </div>
                      {detail ? (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {detail}
                        </p>
                      ) : null}
                    </div>
                    <time className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                      {formatEventTime(event.at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
