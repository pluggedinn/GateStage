import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { eventStatusTextClass } from "@/lib/event-status";
import type { RaceEventEnvelope } from "@/lib/types";

type StatusStripProps = {
  enabledGateCount: number | null;
  lastEvent?: RaceEventEnvelope;
};

function StripCell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 border-border py-1 sm:border-l sm:pl-4 first:sm:border-l-0 first:sm:pl-0",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function formatEventTime(at: string) {
  return new Date(at).toLocaleTimeString();
}

export function StatusStrip({
  enabledGateCount,
  lastEvent,
}: StatusStripProps) {
  const gateLabel =
    enabledGateCount === null
      ? "…"
      : enabledGateCount === 1
        ? "1 gate enabled"
        : `${enabledGateCount} gates enabled`;

  return (
    <section
      aria-label="Race status"
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
    >
      <StripCell label="Gates">
        <span className="font-medium tabular-nums">{gateLabel}</span>
      </StripCell>

      <StripCell label="Last event">
        {lastEvent ? (
          <>
            <span
              data-testid="last-event-type"
              className={cn(
                "truncate font-mono font-medium",
                eventStatusTextClass(lastEvent.type),
              )}
            >
              {lastEvent.type}
            </span>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {formatEventTime(lastEvent.at)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Waiting for events…</span>
        )}
      </StripCell>
    </section>
  );
}
