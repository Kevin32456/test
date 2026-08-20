import { io, Socket } from "socket.io-client";
import type { ClientAction, GameSnapshot, JoinedPayload } from "@shared/types";

export const socket: Socket = io({
  transports: ["websocket", "polling"],
});

export let playerId = "";
export let latestSnapshot: GameSnapshot | null = null;

export function getSocket(): Socket {
  return socket;
}

export function getPlayerId(): string {
  return playerId;
}

export function getLatestSnapshot(): GameSnapshot | null {
  return latestSnapshot;
}

export function sendAction(action: ClientAction) {
  socket.emit("action", action);
}

export function bindNetworkHandlers(handlers: {
  onConnect: () => void;
  onDisconnect: () => void;
  onJoined: (payload: JoinedPayload) => void;
  onState: (snapshot: GameSnapshot) => void;
}) {
  socket.on("connect", handlers.onConnect);
  socket.on("disconnect", handlers.onDisconnect);
  socket.on("joined", (payload: JoinedPayload) => {
    playerId = payload.playerId;
    latestSnapshot = payload.snapshot;
    handlers.onJoined(payload);
  });
  socket.on("state", (snapshot: GameSnapshot) => {
    latestSnapshot = snapshot;
    handlers.onState(snapshot);
  });
}

export function joinRoom(name: string, ack: (ok: boolean) => void) {
  socket.emit("join", { name }, ack);
}
