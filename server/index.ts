import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { GAME } from "../src/shared/constants.js";
import type { ClientAction, JoinPayload } from "../src/shared/types.js";
import { GameRoom } from "./GameRoom.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4318);
const isProd = process.env.NODE_ENV === "production";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: isProd
    ? undefined
    : { origin: ["http://127.0.0.1:4317", "http://localhost:4317"] },
});

const SEND_INTERVAL_MS = 1000 / GAME.NET_SEND_HZ;
let lastSentAt = 0;

function emitState() {
  lastSentAt = Date.now();
  io.emit("state", room.getSnapshot());
}

const room = new GameRoom((immediate) => {
  if (!immediate && Date.now() - lastSentAt < SEND_INTERVAL_MS) return;
  emitState();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, phase: room.getSnapshot().phase });
});

if (isProd) {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("join", (payload: JoinPayload, ack?: (ok: boolean, reason?: string) => void) => {
    const ok = room.addPlayer(
      socket.id,
      payload?.name ?? "",
      payload?.characterId ?? "",
    );
    if (!ok) {
      ack?.(false, "room_full_or_character_taken");
      return;
    }
    ack?.(true);
    socket.emit("joined", {
      playerId: socket.id,
      snapshot: room.getSnapshot(),
    });
    emitState();
  });

  socket.on("action", (action: ClientAction) => {
    room.handleAction(socket.id, action);
  });

  socket.on("disconnect", () => {
    room.removePlayer(socket.id);
    emitState();
  });
});

const HOST = process.env.HOST ?? "0.0.0.0";

httpServer.listen(PORT, HOST, () => {
  console.log(`[shuai-gou] server on http://${HOST}:${PORT}`);
  console.log(`[shuai-gou] max players: ${GAME.MAX_PLAYERS}`);
});
