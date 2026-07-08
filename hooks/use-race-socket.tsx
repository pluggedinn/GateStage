"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  DEFAULT_INTEGRATION_ID,
  type RaceManagerConnectionState,
} from "@/lib/integrations";
import type {
  RaceActionEnvelope,
  RaceEventEnvelope,
} from "@/lib/types";

type RaceSocketValue = {
  events: RaceEventEnvelope[];
  actions: RaceActionEnvelope[];
  connection: RaceManagerConnectionState;
  connected: boolean;
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
  const [connection, setConnection] =
    useState<RaceManagerConnectionState>(defaultConnectionState);
  const [connected, setConnected] = useState(false);

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

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <RaceSocketContext.Provider
      value={{ events, actions, connection, connected }}
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
