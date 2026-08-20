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

const room = new GameRoom(() => {
  io.emit("state", room.getSnapshot());
});

if (isProd) {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("join", (payload: JoinPayload, ack?: (ok: boolean) => void) => {
    const ok = room.addPlayer(socket.id, payload?.name ?? "");
    if (!ok) {
      ack?.(false);
      return;
    }
    ack?.(true);
    socket.emit("joined", {
      playerId: socket.id,
      snapshot: room.getSnapshot(),
    });
    io.emit("state", room.getSnapshot());
  });

  socket.on("action", (action: ClientAction) => {
    room.handleAction(socket.id, action);
  });

  socket.on("disconnect", () => {
    room.removePlayer(socket.id);
    io.emit("state", room.getSnapshot());
  });
});

httpServer.listen(PORT, () => {
  console.log(`[shuai-gou] server on http://127.0.0.1:${PORT}`);
  console.log(`[shuai-gou] max players: ${GAME.MAX_PLAYERS}`);
});
