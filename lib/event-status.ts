export type EventStatusToken = "ok" | "warn" | "error" | "muted";

const TEXT_CLASS: Record<EventStatusToken, string> = {
  ok: "text-status-ok",
  warn: "text-status-warn",
  error: "text-status-error",
  muted: "text-foreground",
};

const BORDER_CLASS: Record<EventStatusToken, string> = {
  ok: "border-l-status-ok",
  warn: "border-l-status-warn",
  error: "border-l-status-error",
  muted: "border-l-border",
};

export function getEventStatus(eventType: string): EventStatusToken {
  switch (eventType) {
    case "heat.go":
    case "pilot.crossing":
      return "ok";
    case "heat.arm_started":
      return "warn";
    case "heat.finished":
      return "error";
    default:
      return "muted";
  }
}

export function eventStatusTextClass(eventType: string): string {
  return TEXT_CLASS[getEventStatus(eventType)];
}

export function eventStatusBorderClass(eventType: string): string {
  return BORDER_CLASS[getEventStatus(eventType)];
}
