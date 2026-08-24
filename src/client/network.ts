import { io, Socket } from "socket.io-client";
import type { ArenaId } from "@shared/arenas";
import type { ClientAction, GameSnapshot, JoinedPayload } from "@shared/types";

type NetworkHandlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onJoined: (payload: JoinedPayload) => void;
};

let socket: Socket | null = null;
let activeServerUrl = "";
let networkHandlers: NetworkHandlers | null = null;

export let playerId = "";
export let latestSnapshot: GameSnapshot | null = null;

type StateListener = (snapshot: GameSnapshot) => void;
const stateListeners = new Set<StateListener>();

function bindLifecycleHandlers(nextSocket: Socket) {
  if (!networkHandlers) return;

  nextSocket.on("connect", networkHandlers.onConnect);
  nextSocket.on("disconnect", networkHandlers.onDisconnect);
  nextSocket.on("joined", (payload: JoinedPayload) => {
    playerId = payload.playerId;
    latestSnapshot = payload.snapshot;
    networkHandlers?.onJoined(payload);
  });
}

function ensureSocket(): Socket {
  if (socket) return socket;

  socket = io(activeServerUrl || undefined, {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
  socket.on("state", (snapshot: GameSnapshot) => {
    latestSnapshot = snapshot;
    for (const listener of stateListeners) {
      listener(snapshot);
    }
  });
  bindLifecycleHandlers(socket);
  socket.connect();
  return socket;
}

function normalizeServerUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function configureServerUrl(
  value: string,
): { ok: true; url: string } | { ok: false; reason: "invalid_url" } {
  const nextUrl = normalizeServerUrl(value);
  if (nextUrl === null) return { ok: false, reason: "invalid_url" };
  if (socket && nextUrl === activeServerUrl) return { ok: true, url: nextUrl };

  socket?.disconnect();
  socket = null;
  playerId = "";
  latestSnapshot = null;
  activeServerUrl = nextUrl;
  ensureSocket();
  return { ok: true, url: nextUrl };
}

export function getServerUrl(): string {
  return activeServerUrl;
}

export function getSocket(): Socket {
  return ensureSocket();
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
  ensureSocket().emit("action", action);
}

export function bindNetworkHandlers(handlers: NetworkHandlers) {
  networkHandlers = handlers;
  if (socket) {
    bindLifecycleHandlers(socket);
    return;
  }
  ensureSocket();
}

export function joinRoom(
  name: string,
  characterId: string,
  roomCode: string,
  arenaId: ArenaId,
  ack: (ok: boolean, reason?: string) => void,
) {
  ensureSocket().emit("join", { name, characterId, roomCode, arenaId }, ack);
}
