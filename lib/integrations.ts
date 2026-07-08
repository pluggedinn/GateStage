export const INTEGRATION_IDS = ["next", "trackside", "rotorhazard"] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export type IntegrationStatus = "available" | "wip";

export type IntegrationDescriptor = {
  id: IntegrationId;
  label: string;
  status: IntegrationStatus;
  description: string;
  docsUrl?: string;
};

export type RaceManagerConnectionState = {
  provider: IntegrationId;
  connected: boolean;
  status: IntegrationStatus;
};

export const DEFAULT_INTEGRATION_ID: IntegrationId = "next";

export const INTEGRATIONS: readonly IntegrationDescriptor[] = [
  {
    id: "next",
    label: "Next",
    status: "available",
    description: "Next race director desktop app (WebSocket)",
    docsUrl: "https://go-next.co/",
  },
  {
    id: "trackside",
    label: "FPV Trackside",
    status: "wip",
    description: "FPV Trackside race management (work in progress)",
  },
  {
    id: "rotorhazard",
    label: "RotorHazard",
    status: "available",
    description:
      "RotorHazard lap timer (Socket.io). Heat lifecycle and crossings; pilot names pending.",
    docsUrl: "https://github.com/RotorHazard/RotorHazard",
  },
] as const;

export function getIntegration(
  id: IntegrationId,
): IntegrationDescriptor | undefined {
  return INTEGRATIONS.find((integration) => integration.id === id);
}

export function isIntegrationAvailable(id: IntegrationId): boolean {
  return getIntegration(id)?.status === "available";
}
