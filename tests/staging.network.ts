import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { GameSnapshot, JoinedPayload } from "../src/shared/types.js";

const baseUrl = (process.env.STAGING_URL ?? "http://127.0.0.1:4318").replace(/\/+$/, "");
const roomCode = `NET${Date.now().toString(36).toUpperCase().slice(-7)}`.slice(0, 12);
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
  stateTimes: number[];
  connectMs: number;
  joinAckMs: number;
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

function connectAndJoin(
  name: string,
  characterId: string,
): Promise<Session> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const socket = io(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000,
    });
    sockets.add(socket);
    const states: GameSnapshot[] = [];
    const stateTimes: number[] = [];
    let connectedAt = 0;
    let joinAckMs = 0;
    let joinAcked = false;
    let joinedPayload: JoinedPayload | null = null;
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

    socket.on("state", (snapshot: GameSnapshot) => {
      states.push(snapshot);
      stateTimes.push(performance.now());
    });
    socket.once("joined", (joined: JoinedPayload) => {
      joinedPayload = joined;
      if (joinAcked) finish();
    });
    socket.once("connect_error", (error) => fail(error));
    socket.once("connect", () => {
      connectedAt = performance.now();
      socket.emit(
        "join",
        { name, characterId, roomCode, arenaId: "moon-garden" },
        (ok: boolean, reason?: string) => {
          if (!ok) {
            fail(new Error(`join rejected for ${name}: ${reason ?? "unknown"}`));
            return;
          }
          joinAckMs = performance.now() - connectedAt;
          joinAcked = true;
          finish();
        },
      );
    });

    function finish() {
      if (settled || !joinAcked || !joinedPayload) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        socket,
        joined: joinedPayload,
        states,
        stateTimes,
        connectMs: connectedAt - startedAt,
        joinAckMs,
      });
    }
  });
}

function stateIntervals(session: Session) {
  return session.stateTimes
    .slice(1)
    .map((time, index) => time - session.stateTimes[index]!);
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]!;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

const before = await readStatus();
let first: Session | null = null;
let second: Session | null = null;
let reconnected: Session | null = null;
let measured: Record<string, unknown> = {};
let resultVersion = "";

try {
  first = await connectAndJoin("NET-A", "hat");
  second = await connectAndJoin("NET-B", "gauntlet");
  first.socket.emit("action", { type: "start" });

  await waitFor(
    "network baseline playing",
    () => [first!, second!].some((session) => session.states.some((state) => state.phase === "playing")),
    9000,
  );
  await delay(3000);

  const intervals = stateIntervals(first);
  assert.ok(intervals.length >= 10, "not enough real state packets for jitter baseline");
  assert.ok(first.states.some((state) => state.arenaId === "moon-garden"));
  assert.ok(second.states.some((state) => state.arenaId === "moon-garden"));

  const statesBeforeDisconnect = second.states.length;
  first.socket.disconnect();
  await waitFor(
    "transport disconnect visible",
    async () => {
      const status = await readStatus();
      return status.players === before.players + 1 && status.connections === before.connections + 1;
    },
    8000,
  );
  await waitFor(
    "round settles after disconnect",
    () => second!.states.slice(statesBeforeDisconnect).some((state) => state.phase === "ended" || state.phase === "lobby"),
    5000,
  );

  reconnected = await connectAndJoin("NET-A-RECONNECTED", "hat");
  await waitFor(
    "reconnection visible",
    async () => {
      const status = await readStatus();
      return status.players === before.players + 2 && status.connections === before.connections + 2;
    },
    8000,
  );

  resultVersion = (await readStatus()).version;
  measured = {
    connectMs: Math.round(first.connectMs),
    joinAckMs: Math.round(first.joinAckMs),
    stateSamples: intervals.length,
    stateIntervalMs: {
      min: Math.round(Math.min(...intervals)),
      p50: Math.round(percentile(intervals, 0.5)),
      p95: Math.round(percentile(intervals, 0.95)),
      max: Math.round(Math.max(...intervals)),
      jitterStdDev: Math.round(standardDeviation(intervals)),
    },
    disconnectReconnect: "passed",
  };
} finally {
  for (const session of [first, second, reconnected]) session?.socket.disconnect();
  await waitFor(
    "network test cleanup",
    async () => {
      const status = await readStatus();
      return status.rooms === before.rooms &&
        status.players === before.players &&
        status.connections === before.connections;
    },
    10000,
  ).catch(() => undefined);
  for (const socket of sockets) socket.disconnect();
}

const final = await readStatus();
assert.equal(final.rooms, before.rooms);
assert.equal(final.players, before.players);
assert.equal(final.connections, before.connections);
console.log(JSON.stringify({
  ok: true,
  baseUrl,
  roomCode,
  version: resultVersion || final.version,
  measured,
  final,
}, null, 2));
