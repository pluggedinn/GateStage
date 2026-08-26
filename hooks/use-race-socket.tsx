"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  GateHealth,
  GateHealthEvent,
  GateHealthSnapshot,
} from "@/lib/gate-health";
import {
  DEFAULT_INTEGRATION_ID,
  type RaceManagerConnectionState,
} from "@/lib/integrations";
import type { RaceActionEnvelope, RaceEventEnvelope } from "@/lib/types";

type RaceSocketValue = {
  events: RaceEventEnvelope[];
  actions: RaceActionEnvelope[];
  connection: RaceManagerConnectionState;
  connected: boolean;
  healthById: Record<string, GateHealth>;
  configRevision: number;
};

const defaultConnectionState: RaceManagerConnectionState = {
  provider: DEFAULT_INTEGRATION_ID,
  connected: false,
  status: "available",
};

const RaceSocketContext = createContext<RaceSocketValue | null>(null);

export function RaceSocketProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<RaceEventEnvelope[]>([]);
  const [actions, setActions] = useState<RaceActionEnvelope[]>([]);
  const [connection, setConnection] = useState<RaceManagerConnectionState>(
    defaultConnectionState,
  );
  const [connected, setConnected] = useState(false);
  const [healthById, setHealthById] = useState<Record<string, GateHealth>>({});
  const [configRevision, setConfigRevision] = useState(0);

  useEffect(() => {
    const socket: Socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("race:event", (event: RaceEventEnvelope) => {
      setEvents((prev) => [event, ...prev].slice(0, 100));
    });
    socket.on("race:action", (action: RaceActionEnvelope) => {
      setActions((prev) => [action, ...prev].slice(0, 100));
    });
    socket.on("connection:raceManager", (state: RaceManagerConnectionState) => {
      setConnection(state);
    });
    socket.on("gate:health:snapshot", (snapshot: GateHealthSnapshot) => {
      setHealthById(snapshot);
    });
    socket.on("gate:health", (event: GateHealthEvent) => {
      setHealthById((prev) => ({
        ...prev,
        [event.gateId]: {
          online: event.online,
          lastSeenAt: event.lastSeenAt,
          rssi: event.rssi,
          tempC: event.tempC,
        },
      }));
    });
    socket.on("config:updated", () => {
      setConfigRevision((n) => n + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <RaceSocketContext.Provider
      value={{
        events,
        actions,
        connection,
        connected,
        healthById,
        configRevision,
      }}
    >
      {children}
    </RaceSocketContext.Provider>
  );
}

export function useRaceSocket() {
  const value = useContext(RaceSocketContext);
  if (!value) {
    throw new Error("useRaceSocket must be used within RaceSocketProvider");
  }
  return value;
}
