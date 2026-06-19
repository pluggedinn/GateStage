"use client";

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

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className="gap-1">
      <span
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-zinc-500"}`}
      />
      {label}
    </Badge>
  );
}

export default function DashboardPage() {
  const { events, actions, connection, connected } = useRaceSocket();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live race events and gate actions
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatusBadge
          ok={connected}
          label={connected ? "Socket.io connected" : "Socket.io disconnected"}
        />
        <StatusBadge
          ok={connection.nextConnected}
          label={
            connection.nextConnected ? "Next connected" : "Next disconnected"
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Race events</CardTitle>
            <CardDescription>From Next race director (mock or real)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 pr-4">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events yet. Run{" "}
                  <code className="text-xs">npm run dev:mocks</code> and emit via
                  mock Next HTTP API.
                </p>
              ) : (
                <ul className="space-y-2">
                  {events.map((event, i) => (
                    <li
                      key={`${event.at}-${i}`}
                      className="rounded-md border border-border bg-muted/30 p-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-emerald-400">
                          {event.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.at).toLocaleTimeString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
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
                <p className="text-sm text-muted-foreground">
                  Gate commands appear here when events trigger mappings.
                </p>
              ) : (
                <ul className="space-y-2">
                  {actions.map((action, i) => (
                    <li
                      key={`${action.at}-${i}`}
                      className="rounded-md border border-border bg-muted/30 p-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">{action.gateId}</span>{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {action.command}
                        </span>
                        <Badge
                          variant={action.success ? "default" : "destructive"}
                        >
                          {action.success ? "ok" : "fail"}
                        </Badge>
                      </div>
                      {action.error && (
                        <p className="mt-1 text-xs text-destructive">
                          {action.error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
