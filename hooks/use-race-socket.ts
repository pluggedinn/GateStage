"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  RaceActionEnvelope,
  RaceEventEnvelope,
} from "@/lib/types";

type ConnectionState = {
  nextConnected: boolean;
};

export function useRaceSocket() {
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

  return { events, actions, connection, connected };
}
