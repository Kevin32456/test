import { io, Socket } from "socket.io-client";
import type { ClientAction, GameSnapshot, JoinedPayload } from "@shared/types";

export const socket: Socket = io({
  transports: ["websocket", "polling"],
});

export let playerId = "";
export let latestSnapshot: GameSnapshot | null = null;

type StateListener = (snapshot: GameSnapshot) => void;
const stateListeners = new Set<StateListener>();

socket.on("state", (snapshot: GameSnapshot) => {
  latestSnapshot = snapshot;
  for (const listener of stateListeners) {
    listener(snapshot);
  }
});

export function getSocket(): Socket {
  return socket;
}

export function getPlayerId(): string {
  return playerId;
}

export function getLatestSnapshot(): GameSnapshot | null {
  return latestSnapshot;
}

export function subscribeState(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function sendAction(action: ClientAction) {
  socket.emit("action", action);
}

export function bindNetworkHandlers(handlers: {
  onConnect: () => void;
  onDisconnect: () => void;
  onJoined: (payload: JoinedPayload) => void;
}) {
  socket.on("connect", handlers.onConnect);
  socket.on("disconnect", handlers.onDisconnect);
  socket.on("joined", (payload: JoinedPayload) => {
    playerId = payload.playerId;
    latestSnapshot = payload.snapshot;
    handlers.onJoined(payload);
  });
}

export function joinRoom(
  name: string,
  characterId: string,
  ack: (ok: boolean, reason?: string) => void,
) {
  socket.emit("join", { name, characterId }, ack);
}
