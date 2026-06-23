"use client";

import { useRaceSocket } from "@/hooks/use-race-socket";
import { cn } from "@/lib/utils";

function ConnectionIndicator({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs sm:gap-1.5 sm:text-sm"
      title={ok ? `${label} connected` : `${label} disconnected`}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          ok ? "bg-status-ok" : "bg-status-muted",
        )}
        aria-hidden
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function ConnectionStatus() {
  const { connected, connection } = useRaceSocket();

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-border pl-2 sm:gap-3 sm:border-l sm:pl-3"
      aria-label="Connection status"
      data-testid="connection-status"
    >
      <ConnectionIndicator label="Socket" ok={connected} />
      <ConnectionIndicator label="Next" ok={connection.nextConnected} />
    </div>
  );
}
