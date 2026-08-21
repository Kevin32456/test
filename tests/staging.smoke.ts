import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { GameSnapshot, JoinedPayload } from "../src/shared/types.js";

const baseUrl = (process.env.STAGING_URL ?? "http://127.0.0.1:4318").replace(/\/+$/, "");
const seed = Date.now().toString(36).toUpperCase().slice(-5);
const roomCodes = [`ST${seed}A`, `ST${seed}B`];
const specs = [
  { name: "STAGE-A", characterId: "hat", roomCode: roomCodes[0] },
  { name: "STAGE-B", characterId: "gauntlet", roomCode: roomCodes[0] },
  { name: "STAGE-C", characterId: "spike", roomCode: roomCodes[1] },
  { name: "STAGE-D", characterId: "coat", roomCode: roomCodes[1] },
];

type HealthResponse = {
  ok: boolean;
  ready: boolean;
  rooms: number;
  players: number;
  connections: number;
  version: string;
};

type Session = {
  socket: Socket;
  joined: JoinedPayload;
  states: GameSnapshot[];
};

const sockets = new Set<Socket>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHealth(): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/ready`, { cache: "no-store" });
  assert.equal(response.ok, true, `ready endpoint returned HTTP ${response.status}`);
  const payload = (await response.json()) as HealthResponse;
  assert.equal(payload.ok, true);
  assert.equal(payload.ready, true);
  return payload;
}

function connectAndJoin(spec: (typeof specs)[number]): Promise<Session> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    sockets.add(socket);
    const states: GameSnapshot[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`timeout joining ${spec.roomCode}`));
    }, 8000);

    socket.on("state", (snapshot: GameSnapshot) => {
      states.push(snapshot);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once("connect", () => {
      socket.emit("join", spec, (ok: boolean, reason?: string) => {
        if (!ok) {
          clearTimeout(timer);
          reject(new Error(`join rejected: ${reason ?? "unknown"}`));
        }
      });
    });
    socket.once("joined", (joined: JoinedPayload) => {
      clearTimeout(timer);
      resolve({ socket, joined, states });
    });
  });
}

try {
  const before = await readHealth();
  const sessions = await Promise.all(specs.map(connectAndJoin));
  await delay(150);

  const alpha = sessions[0].states.at(-1) ?? sessions[0].joined.snapshot;
  const beta = sessions[2].states.at(-1) ?? sessions[2].joined.snapshot;
  assert.deepEqual(
    alpha.players.map((player) => player.name).sort(),
    ["STAGE-A", "STAGE-B"],
  );
  assert.deepEqual(
    beta.players.map((player) => player.name).sort(),
    ["STAGE-C", "STAGE-D"],
  );
  assert.equal(alpha.players.some((player) => player.name === "STAGE-C"), false);
  assert.equal(beta.players.some((player) => player.name === "STAGE-A"), false);

  const afterJoin = await readHealth();
  assert.ok(afterJoin.rooms >= before.rooms + 2, "expected two additional rooms");
  assert.ok(afterJoin.players >= before.players + 4, "expected four additional players");
  assert.ok(afterJoin.connections >= before.connections + 4, "expected four additional connections");

  for (const session of sessions) session.socket.disconnect();
  await delay(150);

  // Reusing every character proves the previous sockets were removed from both rooms.
  const recycled = await Promise.all(specs.map(connectAndJoin));
  assert.equal(recycled.length, specs.length);
  for (const session of recycled) session.socket.disconnect();
  await delay(150);
  const afterCleanup = await readHealth();

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        rooms: roomCodes,
        version: afterJoin.version,
        before,
        afterJoin,
        afterCleanup,
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of sockets) socket.disconnect();
  await delay(150);
}
