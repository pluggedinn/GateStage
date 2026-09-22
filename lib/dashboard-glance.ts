import {
  NOTHING_SENT_COMMAND,
  type RaceActionEnvelope,
  type RaceEventEnvelope,
  ROUTINE_LOG_GATE_ID,
} from "@/lib/types";

/** Older sessions recorded this. The dashboard does not surface it. */
const HIDDEN_ROUTINE_NOTICE = "No routine";

/** Same error band as the Gates table: below this is a problem. */
export const POOR_RSSI_DBM = -80;
/** Same error band as the Gates table. */
export const HOT_GATE_C = 80;

const EVENT_TITLE: Record<string, string> = {
  "heat.loaded": "Loaded",
  "heat.arm_started": "Arming",
  "heat.go": "Go",
  "heat.last_call": "Last call",
  "heat.finished": "Finished",
};

export type GateAttention = {
  id: string;
  enabled: boolean;
  online: boolean;
  rssi: number | null;
  tempC: number | null;
};

export type DashboardIssue = {
  id: string;
  tone: "error" | "warn";
  title: string;
  detail: string | null;
  at: string | null;
};

function byAtDesc(a: { at: string }, b: { at: string }) {
  return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
}

function heatNameOf(event: RaceEventEnvelope): string | null {
  const { payload } = event;
  if (!("heat" in payload) || !payload.heat?.name) return null;
  return payload.heat.name;
}

export function timelineTitle(event: RaceEventEnvelope): string {
  if (event.payload.type === "pilot.crossing") return event.payload.pilot.name;
  return EVENT_TITLE[event.type] ?? event.type;
}

export function timelineDetail(event: RaceEventEnvelope): string | null {
  if (event.payload.type === "pilot.crossing") {
    return `Lap ${event.payload.crossing.lap}`;
  }
  const parts: string[] = [];
  if (
    event.payload.type === "heat.last_call" &&
    event.payload.seconds !== undefined
  ) {
    parts.push(`${event.payload.seconds}s`);
  }
  const name = heatNameOf(event);
  if (name) parts.push(name);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function timelinePilotColor(
  event: RaceEventEnvelope,
): { r: number; g: number; b: number } | null {
  if (event.payload.type !== "pilot.crossing") return null;
  return event.payload.pilot.color;
}

function actionsForEvent(
  event: RaceEventEnvelope,
  actions: RaceActionEnvelope[],
) {
  return actions.filter((action) => action.eventAt === event.at);
}

function isRoutineNotice(action: RaceActionEnvelope) {
  return (
    action.gateId === ROUTINE_LOG_GATE_ID &&
    action.command === NOTHING_SENT_COMMAND
  );
}

/** Short mark for an event row. Null when the event produced no problem. */
export function eventIssueLabel(
  event: RaceEventEnvelope,
  actions: RaceActionEnvelope[],
): string | null {
  const related = actionsForEvent(event, actions);
  if (related.some((action) => action.command === NOTHING_SENT_COMMAND)) {
    return NOTHING_SENT_COMMAND;
  }
  const failed = related.filter(
    (action) => !action.success && action.gateId !== ROUTINE_LOG_GATE_ID,
  );
  if (failed.length === 1) return `${failed[0].gateId} failed`;
  if (failed.length > 1) return `${failed.length} failed`;
  return null;
}

function gateIssues(gates: GateAttention[]): DashboardIssue[] {
  const issues: DashboardIssue[] = [];
  const ordered = [...gates].sort((a, b) => a.id.localeCompare(b.id));
  for (const gate of ordered) {
    if (!gate.enabled) continue;
    if (!gate.online) {
      issues.push({
        id: `offline-${gate.id}`,
        tone: "error",
        title: gate.id,
        detail: "Offline",
        at: null,
      });
      continue;
    }
    if (gate.rssi !== null && gate.rssi < POOR_RSSI_DBM) {
      issues.push({
        id: `rssi-${gate.id}`,
        tone: "error",
        title: gate.id,
        detail: `Weak signal · ${Math.round(gate.rssi)} dBm`,
        at: null,
      });
    }
    if (gate.tempC !== null && gate.tempC >= HOT_GATE_C) {
      issues.push({
        id: `temp-${gate.id}`,
        tone: "error",
        title: gate.id,
        detail: `Hot · ${Math.round(gate.tempC)}°C`,
        at: null,
      });
    }
  }
  return issues;
}

/** Offline or unhealthy gates, failed commands, and routines that sent nothing. */
export function dashboardIssues(
  events: RaceEventEnvelope[],
  actions: RaceActionEnvelope[],
  gates: GateAttention[],
): DashboardIssue[] {
  const eventByAt = new Map(events.map((event) => [event.at, event]));
  const commandIssues: DashboardIssue[] = [];

  for (const action of actions) {
    if (action.command === HIDDEN_ROUTINE_NOTICE) continue;
    if (isRoutineNotice(action)) {
      const event = action.eventAt ? eventByAt.get(action.eventAt) : undefined;
      const title = event
        ? `${timelineTitle(event)} · ${action.command}`
        : action.command;
      commandIssues.push({
        id: `notice-${action.at}-${action.command}`,
        tone: "warn",
        title,
        detail: event ? timelineDetail(event) : null,
        at: action.at,
      });
      continue;
    }
    if (!action.success && action.gateId !== ROUTINE_LOG_GATE_ID) {
      commandIssues.push({
        id: `fail-${action.at}-${action.gateId}`,
        tone: "error",
        title: `${action.gateId} · ${action.command}`,
        detail: action.error ?? "Command failed",
        at: action.at,
      });
    }
  }

  commandIssues.sort((a, b) => {
    if (a.at === b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at < b.at ? 1 : -1;
  });

  return [...gateIssues(gates), ...commandIssues];
}

export function eventsNewestFirst(events: RaceEventEnvelope[]) {
  return [...events].sort(byAtDesc);
}
