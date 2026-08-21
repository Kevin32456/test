import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { ClientAction, GameSnapshot, JoinedPayload } from "../src/shared/types.js";

const baseUrl = (process.env.STAGING_URL ?? "http://127.0.0.1:4318").replace(/\/+$/, "");
const seed = Date.now().toString(36).toUpperCase().slice(-5);
const roomCode = `FULL${seed}`;
type PlayerSpec = {
  name: string;
  characterId: string;
  roomCode: string;
};

const specs: PlayerSpec[] = [
  { name: "FULL-A", characterId: "hat", roomCode },
  { name: "FULL-B", characterId: "gauntlet", roomCode },
  { name: "FULL-C", characterId: "spike", roomCode },
  { name: "FULL-D", characterId: "coat", roomCode },
  { name: "FULL-E", characterId: "ninja", roomCode },
  { name: "FULL-F", characterId: "miko", roomCode },
  { name: "FULL-G", characterId: "mechanic", roomCode },
  { name: "FULL-H", characterId: "captain", roomCode },
] as const;

type RuntimeStatus = {
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

type SimulationStats = {
  scheduled: number;
  sent: number;
  dropped: number;
  minDelayMs: number;
  maxDelayMs: number;
};

const sockets = new Set<Socket>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRandom(seedValue: number) {
  let state = seedValue >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const random = createRandom(Date.now());

async function readStatus(): Promise<RuntimeStatus> {
  const response = await fetch(`${baseUrl}/ready`, { cache: "no-store" });
  assert.equal(response.ok, true, `ready endpoint returned HTTP ${response.status}`);
  const payload = (await response.json()) as RuntimeStatus;
  assert.equal(payload.ok, true);
  assert.equal(payload.ready, true);
  return payload;
}

async function waitForStatus(
  label: string,
  predicate: (status: RuntimeStatus) => boolean,
  timeoutMs = 10000,
) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: RuntimeStatus | null = null;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      lastStatus = await readStatus();
      if (predicate(lastStatus)) return lastStatus;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }

  throw new Error(
    `${label} timed out; lastStatus=${JSON.stringify(lastStatus)}, lastError=${String(lastError)}`,
  );
}

function connectAndJoin(spec: PlayerSpec): Promise<Session> {
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
      if (!settled) reject(new Error(`timeout joining ${spec.name} in ${spec.roomCode}`));
    }, 12000);

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    socket.on("state", (snapshot: GameSnapshot) => {
      states.push(snapshot);
    });
    socket.once("connect_error", (error) => fail(error));
    socket.once("connect", () => {
      socket.emit("join", spec, (ok: boolean, reason?: string) => {
        if (!ok) fail(new Error(`join rejected for ${spec.name}: ${reason ?? "unknown"}`));
      });
    });
    socket.once("joined", (joined: JoinedPayload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ socket, joined, states });
    });
  });
}

function connectAndExpectFull(spec: PlayerSpec): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000,
    });
    sockets.add(socket);
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error("timeout waiting for full-room rejection"));
    }, 12000);

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    socket.once("connect_error", (error) => fail(error));
    socket.once("joined", () => fail(new Error("ninth client unexpectedly joined a full room")));
    socket.once("connect", () => {
      socket.emit("join", spec, (ok: boolean, reason?: string) => {
        if (ok) {
          fail(new Error("ninth client join acknowledgement unexpectedly succeeded"));
          return;
        }
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.disconnect();
        resolve(reason ?? "unknown");
      });
    });
  });
}

function lastState(session: Session) {
  return session.states.at(-1) ?? session.joined.snapshot;
}

function makeAction(index: number, sessions: Session[]): ClientAction {
  const angle = random() * Math.PI * 2;
  if (random() < 0.12) {
    return {
      type: "blink",
      x: 450 + Math.cos(angle) * (120 + random() * 260),
      y: 450 + Math.sin(angle) * (120 + random() * 260),
    };
  }
  if (random() < 0.08) {
    const target = sessions[(index + 1 + Math.floor(random() * (sessions.length - 1))) % sessions.length]!;
    return { type: "pass", targetId: target.joined.playerId };
  }
  return { type: "moveInput", x: Math.cos(angle), y: Math.sin(angle) };
}

async function simulateJitterAndLoss(sessions: Session[]): Promise<SimulationStats> {
  const stats: SimulationStats = {
    scheduled: 0,
    sent: 0,
    dropped: 0,
    minDelayMs: Number.POSITIVE_INFINITY,
    maxDelayMs: 0,
  };
  const pending: Promise<void>[] = [];
  const actionsPerClient = 24;
  const dropRate = 0.2;

  for (const [index, session] of sessions.entries()) {
    for (let actionIndex = 0; actionIndex < actionsPerClient; actionIndex += 1) {
      const jitterMs = Math.floor(random() * 180);
      const delayMs = actionIndex * 150 + jitterMs;
      stats.scheduled += 1;
      stats.minDelayMs = Math.min(stats.minDelayMs, delayMs);
      stats.maxDelayMs = Math.max(stats.maxDelayMs, delayMs);
      pending.push(
        new Promise((resolve) => {
          setTimeout(() => {
            if (random() < dropRate) {
              stats.dropped += 1;
              resolve();
              return;
            }
            session.socket.emit("action", makeAction(index, sessions));
            stats.sent += 1;
            resolve();
          }, delayMs);
        }),
      );
    }
  }

  await Promise.all(pending);
  return stats;
}

const before = await readStatus();
const sessions: Session[] = [];

try {
  const joined = await Promise.all(specs.map(connectAndJoin));
  sessions.push(...joined);

  const joinedStatus = await waitForStatus(
    "eight-player join",
    (status) => status.players >= before.players + 8 && status.connections >= before.connections + 8,
  );

  await waitForStatus(
    "all clients receive full roster",
    () => sessions.every((session) => lastState(session).players.length === 8),
  );

  const roster = lastState(sessions[0]).players.map((player) => player.name).sort();
  assert.deepEqual(roster, specs.map((spec) => spec.name).sort());

  const rejectionReason = await connectAndExpectFull({
    name: "FULL-9",
    characterId: "hat",
    roomCode,
  });
  assert.equal(rejectionReason, "room_full_or_character_taken");

  sessions[0].socket.emit("action", { type: "start" });
  await waitForStatus(
    "eight-player countdown/playing transition",
    () => sessions.some((session) => ["countdown", "playing"].includes(lastState(session).phase)),
  );
  await waitForStatus(
    "eight-player playing phase",
    () => sessions.some((session) => lastState(session).phase === "playing"),
    8000,
  );

  const network = await simulateJitterAndLoss(sessions);
  await delay(250);
  const afterNetwork = await readStatus();
  assert.ok(afterNetwork.players >= before.players + 8, "network simulation lost a player on the server");
  assert.ok(afterNetwork.connections >= before.connections + 8, "network simulation lost a connection");
  assert.ok(sessions.every((session) => session.socket.connected), "a client disconnected during simulation");
  assert.ok(sessions.every((session) => session.states.length >= 3), "clients did not receive state updates");
  assert.ok(network.dropped > 0, "loss simulation did not drop any commands");
  assert.ok(network.sent > 0, "loss simulation did not send any commands");

  for (const session of sessions) session.socket.disconnect();
  const cleaned = await waitForStatus(
    "eight-player cleanup",
    (status) =>
      status.rooms === before.rooms &&
      status.players === before.players &&
      status.connections === before.connections,
  );

  const recycled = await Promise.all(specs.map(connectAndJoin));
  sessions.push(...recycled);
  const recycledStatus = await waitForStatus(
    "eight-player recycled join",
    (status) => status.players >= before.players + 8 && status.connections >= before.connections + 8,
  );
  for (const session of recycled) session.socket.disconnect();
  const finalStatus = await waitForStatus(
    "recycled eight-player cleanup",
    (status) =>
      status.rooms === before.rooms &&
      status.players === before.players &&
      status.connections === before.connections,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        roomCode,
        clientCount: specs.length,
        version: joinedStatus.version,
        roster,
        rejectionReason,
        network,
        stateEventsPerClient: sessions.slice(0, specs.length).map((session) => session.states.length),
        joinedStatus,
        afterNetwork,
        cleaned,
        recycledStatus,
        finalStatus,
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of sockets) socket.disconnect();
  await delay(250);
}
