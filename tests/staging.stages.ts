import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { ArenaStage } from "../src/shared/arenas.js";
import type { GameSnapshot, JoinedPayload } from "../src/shared/types.js";

const baseUrl = (process.env.STAGING_URL ?? "http://127.0.0.1:4318").replace(/\/+$/, "");
const seed = Date.now().toString(36).toUpperCase().slice(-5);
const roomCode = `STAGE${seed}`.slice(0, 12);
const requiredStages: ArenaStage[] = ["teach", "test", "twist", "mastery"];
const sockets = new Set<Socket>();

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
  lastPassAt: number;
  lastBlinkAt: number;
};

const specs = [
  ["STAGE-A", "hat"],
  ["STAGE-B", "gauntlet"],
  ["STAGE-C", "spike"],
  ["STAGE-D", "coat"],
  ["STAGE-E", "ninja"],
  ["STAGE-F", "miko"],
  ["STAGE-G", "mechanic"],
  ["STAGE-H", "captain"],
] as const;

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

function connectAndJoin(name: string, characterId: string): Promise<Session> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000,
    });
    sockets.add(socket);
    const states: GameSnapshot[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error(`timeout joining ${name}`));
    }, 12000);

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    };

    socket.on("state", (snapshot: GameSnapshot) => states.push(snapshot));
    socket.once("connect_error", (error) => fail(error));
    socket.once("connect", () => {
      socket.emit(
        "join",
        { name, characterId, roomCode, arenaId: "moon-garden" },
        (ok: boolean, reason?: string) => {
          if (!ok) fail(new Error(`join rejected for ${name}: ${reason ?? "unknown"}`));
        },
      );
    });
    socket.once("joined", (joined: JoinedPayload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ socket, joined, states, lastPassAt: 0, lastBlinkAt: 0 });
    });
  });
}

function lastState(session: Session) {
  return session.states.at(-1) ?? session.joined.snapshot;
}

function collectStages(sessions: Session[], stageSeen: Set<ArenaStage>) {
  for (const session of sessions) {
    for (const stage of stagesFor(session)) stageSeen.add(stage);
  }
}

function stagesFor(session: Session) {
  return new Set<ArenaStage>([
    session.joined.snapshot.arenaStage,
    ...session.states.map((state) => state.arenaStage),
  ]);
}

function stageSequenceFor(session: Session) {
  const sequence: ArenaStage[] = [];
  let previous: ArenaStage | null = null;
  for (const state of [session.joined.snapshot, ...session.states]) {
    if (state.arenaStage !== previous) {
      sequence.push(state.arenaStage);
      previous = state.arenaStage;
    }
  }
  return sequence;
}

const before = await readStatus();
const sessions: Session[] = [];
const stageSeen = new Set<ArenaStage>();
let actionTimer: ReturnType<typeof setInterval> | null = null;

try {
  const first = await connectAndJoin(...specs[0]);
  sessions.push(first);
  const rest = await Promise.all(
    specs.slice(1).map((spec) => connectAndJoin(...spec)),
  );
  sessions.push(...rest);

  collectStages(sessions, stageSeen);
  assert.ok(
    sessions.every((session) => lastState(session).arenaId === "moon-garden"),
    "all clients must receive Moon Garden",
  );

  first.socket.emit("action", { type: "start" });
  await waitFor(
    "stage test playing",
    () => sessions.some((session) => lastState(session).phase === "playing"),
    9000,
  );

  const startedAt = Date.now();
  actionTimer = setInterval(() => {
    const elapsedMs = Date.now() - startedAt;
    collectStages(sessions, stageSeen);

    for (const [index, session] of sessions.entries()) {
      const state = lastState(session);
      if (state.phase !== "playing") continue;
      const me = state.players.find((player) => player.id === session.joined.playerId);
      if (!me?.alive) continue;

      const angle = elapsedMs / 1700 + (index * Math.PI * 2) / sessions.length;
      session.socket.emit("action", {
        type: "moveInput",
        x: Math.cos(angle),
        y: Math.sin(angle),
      });

      if (me.blinkCooldownMs <= 0 && elapsedMs - session.lastBlinkAt >= 3200) {
        session.socket.emit("action", {
          type: "blink",
          x: me.x + Math.cos(angle) * 240,
          y: me.y + Math.sin(angle) * 240,
        });
        session.lastBlinkAt = elapsedMs;
      }

      if (
        me.hasBall &&
        !state.ball.inFlight &&
        elapsedMs - session.lastPassAt >= 350
      ) {
        const target = state.players.find(
          (player) => player.id !== me.id && player.alive,
        );
        if (target) {
          session.socket.emit("action", { type: "pass", targetId: target.id });
          session.lastPassAt = elapsedMs;
        }
      }
    }
  }, 100);

  await waitFor(
    "teach-test-twist-mastery sequence",
    () => {
      collectStages(sessions, stageSeen);
      return sessions.every((session) =>
        requiredStages.every((stage) => stagesFor(session).has(stage)),
      );
    },
    42000,
  );

  collectStages(sessions, stageSeen);
  assert.ok(
    sessions.every((session) =>
      requiredStages.every((stage) => stagesFor(session).has(stage)),
    ),
    "all arena stages must reach every client",
  );
  const stageSequences = sessions.map(stageSequenceFor);
  assert.ok(
    stageSequences.every((sequence) =>
      sequence.slice(0, requiredStages.length).every(
        (stage, index) => stage === requiredStages[index],
      ),
    ),
    "arena stages must arrive in teach/test/twist/mastery order",
  );

  const statusDuringMastery = await readStatus();
  assert.ok(statusDuringMastery.players >= before.players + 2, "stage test lost too many players");
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    roomCode,
    arenaId: lastState(sessions[0]).arenaId,
    requiredStages,
    stageSeen: [...stageSeen],
    stageSequenceByClient: stageSequences,
    statusDuringMastery,
  }, null, 2));
} finally {
  if (actionTimer) clearInterval(actionTimer);
  for (const socket of sockets) socket.disconnect();
  await waitFor(
    "stage test cleanup",
    async () => {
      const status = await readStatus();
      return status.rooms === before.rooms &&
        status.players === before.players &&
        status.connections === before.connections;
    },
    12000,
  ).catch(() => undefined);
}
