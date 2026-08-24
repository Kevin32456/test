import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  DEFAULT_ROOM_CODE,
  GAME,
  normalizeRoomCode,
} from "../src/shared/constants.js";
import { GameRoom } from "./GameRoom.js";
import { isClientAction, isJoinPayload } from "./validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4318);
const isProd = process.env.NODE_ENV === "production";
const SERVICE_NAME = "shuai-gou-server";
const APP_VERSION =
  process.env.APP_VERSION ?? process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? "dev";
const STARTED_AT = new Date().toISOString();
const STARTED_AT_MS = Date.now();
let activeConnections = 0;
let totalConnections = 0;
let totalJoinAccepted = 0;
let totalJoinRejected = 0;
let totalDisconnects = 0;
let totalInvalidActions = 0;
let isShuttingDown = false;

type LogDetails = Record<string, string | number | boolean | null | undefined>;

function logEvent(event: string, details: LogDetails = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      version: APP_VERSION,
      event,
      ...details,
    }),
  );
}

const app = express();
export const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: isProd
    ? undefined
    : { origin: ["http://127.0.0.1:4317", "http://localhost:4317"] },
});

const SEND_INTERVAL_MS = 1000 / GAME.NET_SEND_HZ;
const rooms = new Map<string, GameRoom>();
const lastSentAtByRoom = new Map<string, number>();

function resolveClientDistPath(): string {
  if (process.env.CLIENT_DIST_PATH) {
    return path.resolve(process.env.CLIENT_DIST_PATH);
  }

  const candidates = [
    path.join(__dirname, "../dist"),
    path.join(__dirname, "../../dist"),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? candidates[0];
}

function emitRoomState(roomCode: string, immediate = true) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const now = Date.now();
  const lastSentAt = lastSentAtByRoom.get(roomCode) ?? 0;
  if (!immediate && now - lastSentAt < SEND_INTERVAL_MS) return;

  lastSentAtByRoom.set(roomCode, now);
  io.to(roomCode).emit("state", room.getSnapshot());
}

function getOrCreateRoom(roomCode: string): GameRoom {
  const existing = rooms.get(roomCode);
  if (existing) return existing;

  const room = new GameRoom((immediate) => {
    emitRoomState(roomCode, immediate);
  });
  rooms.set(roomCode, room);
  return room;
}

function removeRoomIfEmpty(roomCode: string, room: GameRoom) {
  if (room.getSnapshot().roomCount !== 0 || rooms.get(roomCode) !== room) return;
  rooms.delete(roomCode);
  lastSentAtByRoom.delete(roomCode);
}

function getRuntimeStatus() {
  const snapshots = [...rooms.values()].map((room) => room.getSnapshot());
  const players = snapshots.reduce((total, snapshot) => total + snapshot.roomCount, 0);
  const phase =
    snapshots.length === 0
      ? "lobby"
      : snapshots.length === 1
        ? snapshots[0].phase
        : "multi";
  return {
    ok: true,
    ready: !isShuttingDown,
    service: SERVICE_NAME,
    version: APP_VERSION,
    startedAt: STARTED_AT,
    uptimeSec: Math.floor(process.uptime()),
    phase,
    rooms: rooms.size,
    players,
    connections: activeConnections,
  };
}

function sendRuntimeStatus(res: express.Response) {
  res.setHeader("Cache-Control", "no-store");
  const status = getRuntimeStatus();
  res.status(status.ready ? 200 : 503).json(status);
}

app.get("/health", (_req, res) => {
  sendRuntimeStatus(res);
});

app.get("/ready", (_req, res) => {
  sendRuntimeStatus(res);
});

app.get("/metrics", (_req, res) => {
  const metricLines = [
    "# HELP shuai_gou_ready Whether the process is accepting new work.",
    "# TYPE shuai_gou_ready gauge",
    `shuai_gou_ready ${isShuttingDown ? 0 : 1}`,
    "# HELP shuai_gou_uptime_seconds Process uptime in seconds.",
    "# TYPE shuai_gou_uptime_seconds gauge",
    `shuai_gou_uptime_seconds ${Math.floor((Date.now() - STARTED_AT_MS) / 1000)}`,
    "# HELP shuai_gou_active_connections Current Socket.IO connections.",
    "# TYPE shuai_gou_active_connections gauge",
    `shuai_gou_active_connections ${activeConnections}`,
    "# HELP shuai_gou_rooms Current non-empty rooms.",
    "# TYPE shuai_gou_rooms gauge",
    `shuai_gou_rooms ${rooms.size}`,
    "# HELP shuai_gou_players Current joined players.",
    "# TYPE shuai_gou_players gauge",
    `shuai_gou_players ${getRuntimeStatus().players}`,
    "# HELP shuai_gou_connections_total Total accepted Socket.IO connections.",
    "# TYPE shuai_gou_connections_total counter",
    `shuai_gou_connections_total ${totalConnections}`,
    "# HELP shuai_gou_joins_total Total accepted and rejected joins.",
    "# TYPE shuai_gou_joins_total counter",
    `shuai_gou_joins_total{result="accepted"} ${totalJoinAccepted}`,
    `shuai_gou_joins_total{result="rejected"} ${totalJoinRejected}`,
    "# HELP shuai_gou_disconnects_total Total socket disconnects.",
    "# TYPE shuai_gou_disconnects_total counter",
    `shuai_gou_disconnects_total ${totalDisconnects}`,
    "# HELP shuai_gou_invalid_actions_total Invalid action payloads rejected.",
    "# TYPE shuai_gou_invalid_actions_total counter",
    `shuai_gou_invalid_actions_total ${totalInvalidActions}`,
  ];
  res.setHeader("Cache-Control", "no-store");
  res.type("text/plain; version=0.0.4").send(`${metricLines.join("\n")}\n`);
});

if (isProd) {
  const distPath = resolveClientDistPath();
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  activeConnections += 1;
  totalConnections += 1;
  logEvent("connection_opened", { connections: activeConnections });

  socket.on("join", (payload: unknown, ack?: (ok: boolean, reason?: string) => void) => {
    if (!isJoinPayload(payload)) {
      totalJoinRejected += 1;
      logEvent("join_rejected", {
        reason: "invalid_payload",
        connections: activeConnections,
      });
      ack?.(false, "invalid_payload");
      return;
    }

    if (socket.data.roomCode) {
      totalJoinRejected += 1;
      logEvent("join_rejected", {
        reason: "already_joined",
        roomCode: socket.data.roomCode,
        connections: activeConnections,
      });
      ack?.(false, "already_joined");
      return;
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (!roomCode) {
      totalJoinRejected += 1;
      logEvent("join_rejected", {
        reason: "invalid_room_code",
        connections: activeConnections,
      });
      ack?.(false, "invalid_room_code");
      return;
    }

    const room = getOrCreateRoom(roomCode);
    const ok = room.addPlayer(
      socket.id,
      payload.name,
      payload.characterId,
      payload.arenaId,
    );
    if (!ok) {
      removeRoomIfEmpty(roomCode, room);
      totalJoinRejected += 1;
      logEvent("join_rejected", {
        reason: "room_full_or_character_taken",
        roomCode,
        players: room.getSnapshot().roomCount,
        connections: activeConnections,
      });
      ack?.(false, "room_full_or_character_taken");
      return;
    }

    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    ack?.(true);
    socket.emit("joined", {
      playerId: socket.id,
      snapshot: room.getSnapshot(),
    });
    emitRoomState(roomCode);
    logEvent("join_accepted", {
      roomCode,
      players: room.getSnapshot().roomCount,
      rooms: rooms.size,
    });
    totalJoinAccepted += 1;
  });

  socket.on("action", (action: unknown) => {
    if (!isClientAction(action)) {
      totalInvalidActions += 1;
      logEvent("action_rejected", { reason: "invalid_payload", connections: activeConnections });
      return;
    }
    const roomCode = socket.data.roomCode as string | undefined;
    if (!roomCode) return;
    rooms.get(roomCode)?.handleAction(socket.id, action);
  });

  socket.on("disconnect", (reason: string) => {
    activeConnections = Math.max(0, activeConnections - 1);
    totalDisconnects += 1;
    const roomCode = socket.data.roomCode as string | undefined;
    if (!roomCode) {
      logEvent("connection_closed", {
        reason,
        connections: activeConnections,
      });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      logEvent("connection_closed", {
        reason,
        roomCode,
        connections: activeConnections,
      });
      return;
    }
    room.removePlayer(socket.id);
    emitRoomState(roomCode);
    removeRoomIfEmpty(roomCode, room);
    logEvent("connection_closed", {
      reason,
      roomCode,
      connections: activeConnections,
      rooms: rooms.size,
    });
  });
});

const HOST = process.env.HOST ?? "0.0.0.0";

httpServer.listen(PORT, HOST, () => {
  logEvent("server_started", {
    host: HOST,
    port: PORT,
    nodeEnv: process.env.NODE_ENV ?? "development",
    defaultRoom: DEFAULT_ROOM_CODE,
    maxPlayers: GAME.MAX_PLAYERS,
  });
});

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logEvent("server_stopping", { signal, rooms: rooms.size, connections: activeConnections });
  io.close();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
    setTimeout(resolve, 10000).unref();
  });
  logEvent("server_stopped", { signal });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logEvent("process_error", { kind: "unhandled_rejection", error: String(reason) });
});
process.on("uncaughtException", (error) => {
  logEvent("process_error", {
    kind: "uncaught_exception",
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  process.exitCode = 1;
  void shutdown("uncaughtException");
});
