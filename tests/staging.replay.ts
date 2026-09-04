import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { GameSnapshot, JoinedPayload } from "../src/shared/types.js";

const baseUrl = (process.env.STAGING_URL ?? "http://127.0.0.1:4318").replace(/\/+$/, "");
const rounds = Math.max(2, Number(process.env.REPLAY_ROUNDS ?? 4));
const roundDurationMs = Math.max(2500, Number(process.env.REPLAY_ROUND_MS ?? 5000));
const requestedClientCount = Number(process.env.REPLAY_CLIENTS ?? 2);
const clientCount = Number.isFinite(requestedClientCount)
  ? Math.min(8, Math.max(2, Math.floor(requestedClientCount)))
  : 2;
const seed = Date.now().toString(36).toUpperCase().slice(-5);
const sockets = new Set<Socket>();

const replaySpecs = [
  { suffix: "A", characterId: "hat" },
  { suffix: "B", characterId: "gauntlet" },
  { suffix: "C", characterId: "spike" },
  { suffix: "D", characterId: "coat" },
  { suffix: "E", characterId: "ninja" },
  { suffix: "F", characterId: "miko" },
  { suffix: "G", characterId: "mechanic" },
  { suffix: "H", characterId: "captain" },
] as const;

type Status = {
  ok: boolean;
  ready: boolean;
  rooms: number;
  players: number;
  connections: number;
  version: string;
  phase: string;
};

type Session = {
  socket: Socket;
  joined: JoinedPayload;
  states: GameSnapshot[];
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStatus(): Promise<Status> {
  const response = await fetch(`${baseUrl}/ready`, { cache: "no-store" });
  assert.equal(response.ok, true, `ready endpoint returned HTTP ${response.status}`);
  const status = (await response.json()) as Status;
  assert.equal(status.ok, true);
  assert.equal(status.ready, true);
  return status;
}

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(100);
  }
  throw new Error(`${label} timed out`);
}

function connectAndJoin(name: string, characterId: string, roomCode: string): Promise<Session> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    sockets.add(socket);
    const states: GameSnapshot[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error(`timeout joining ${name}`));
    }, 8000);

    socket.on("state", (snapshot: GameSnapshot) => states.push(snapshot));
    socket.once("connect_error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    socket.once("connect", () => {
      socket.emit(
        "join",
        { name, characterId, roomCode, arenaId: "moon-garden" },
        (ok: boolean, reason?: string) => {
          if (!ok && !settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(`join rejected for ${name}: ${reason ?? "unknown"}`));
          }
        },
      );
    });
    socket.once("joined", (joined: JoinedPayload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ socket, joined, states });
    });
  });
}

function lastState(session: Session) {
  return session.states.at(-1) ?? session.joined.snapshot;
}

async function playRound(roundIndex: number) {
  const roomCode = `RP${seed}${String(roundIndex).padStart(2, "0")}`.slice(0, 12);
  const sessions: Session[] = [];
  for (const spec of replaySpecs.slice(0, clientCount)) {
    sessions.push(await connectAndJoin(`REPLAY-${spec.suffix}-${roundIndex}`, spec.characterId, roomCode));
  }
  const first = sessions[0]!;

  first.socket.emit("action", { type: "start" });
  await waitFor(
    `round ${roundIndex} playing`,
    () => sessions.some((session) => lastState(session).phase === "playing"),
    9000,
  );

  const deadline = Date.now() + roundDurationMs;
  let actionCount = 0;
  while (Date.now() < deadline) {
    for (const [index, session] of sessions.entries()) {
      const angle =
        (actionCount / 8 + (index * Math.PI * 2) / sessions.length) %
        (Math.PI * 2);
      session.socket.emit("action", {
        type: "moveInput",
        x: Math.cos(angle),
        y: Math.sin(angle),
      });
      const state = lastState(session);
      const target = sessions[(index + 1) % sessions.length]!;
      const targetAlive = lastState(target).players.some(
        (player) => player.id === target.joined.playerId && player.alive,
      );
      if (
        targetAlive &&
        state.ballHolderId === session.joined.playerId &&
        !state.ball.inFlight
      ) {
        session.socket.emit("action", {
          type: "pass",
          targetId: target.joined.playerId,
        });
      }
    }
    actionCount += 1;
    await delay(100);
  }

  for (const session of sessions) {
    assert.ok(session.states.some((state) => state.phase === "playing"));
  }
  assert.ok(first.states.some((state) => state.arenaId === "moon-garden"));

  for (const session of sessions) session.socket.disconnect();
  return { roomCode, actionCount, stateEvents: sessions.map((session) => session.states.length) };
}

const before = await readStatus();
const completedRounds: Array<{ roomCode: string; actionCount: number; stateEvents: number[] }> = [];

try {
  for (let roundIndex = 1; roundIndex <= rounds; roundIndex += 1) {
    completedRounds.push(await playRound(roundIndex));
    await waitFor(
      `round ${roundIndex} cleanup`,
      async () => {
        const status = await readStatus();
        return status.rooms === before.rooms &&
          status.players === before.players &&
          status.connections === before.connections;
      },
      10000,
    );
  }

  const final = await readStatus();
  assert.equal(final.rooms, before.rooms);
  assert.equal(final.players, before.players);
  assert.equal(final.connections, before.connections);
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    clientCount,
    rounds,
    roundDurationMs,
    completedRounds,
    before,
    final,
  }, null, 2));
} finally {
  for (const socket of sockets) socket.disconnect();
  await delay(150);
}
