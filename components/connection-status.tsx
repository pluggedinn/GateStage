"use client";

import { useRaceSocket } from "@/hooks/use-race-socket";
import { getIntegration } from "@/lib/integrations";
import { cn } from "@/lib/utils";

function ConnectionIndicator({
  label,
  ok,
  muted,
  title,
}: {
  label: string;
  ok: boolean;
  muted?: boolean;
  title?: string;
}) {
  const defaultTitle = muted
    ? `${label} — work in progress`
    : ok
      ? `${label} connected`
      : `${label} disconnected`;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs sm:gap-1.5 sm:text-sm"
      title={title ?? defaultTitle}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          muted
            ? "bg-status-muted"
            : ok
              ? "bg-status-ok"
              : "bg-status-muted",
        )}
        aria-hidden
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function ConnectionStatus() {
  const { connected, connection } = useRaceSocket();
  const integration = getIntegration(connection.provider);
  const label = integration?.label ?? connection.provider;
  const isWip = connection.status === "wip";

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-border pl-2 sm:gap-3 sm:border-l sm:pl-3"
      aria-label="Connection status"
      data-testid="connection-status"
    >
      <ConnectionIndicator label="Socket" ok={connected} />
      <ConnectionIndicator
        label={label}
        ok={connection.connected}
        muted={isWip}
      />
    </div>
  );
}
