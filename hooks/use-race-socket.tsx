"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  RaceActionEnvelope,
  RaceEventEnvelope,
} from "@/lib/types";

type ConnectionState = {
  nextConnected: boolean;
};

type RaceSocketValue = {
  events: RaceEventEnvelope[];
  actions: RaceActionEnvelope[];
  connection: ConnectionState;
  connected: boolean;
};

const RaceSocketContext = createContext<RaceSocketValue | null>(null);

export function RaceSocketProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<RaceEventEnvelope[]>([]);
  const [actions, setActions] = useState<RaceActionEnvelope[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({
    nextConnected: false,
  });
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
    socket.on("connection:next", (state: ConnectionState) => {
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
