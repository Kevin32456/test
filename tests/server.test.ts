import assert from "node:assert/strict";
import { GameRoom } from "../server/GameRoom.js";
import { isClientAction, isJoinPayload } from "../server/validation.js";
import { getArenaStage } from "../src/shared/arenas.js";
import { DEFAULT_ROOM_CODE, normalizeRoomCode } from "../src/shared/constants.js";

assert.equal(isJoinPayload({ name: "玩家", characterId: "hat" }), true);
assert.equal(isJoinPayload({ name: "玩家", characterId: "hat", roomCode: "arena1" }), true);
assert.equal(isJoinPayload({ name: "玩家", characterId: "hat", arenaId: "moon-garden" }), true);
assert.equal(isJoinPayload({ name: "玩家", characterId: "hat", arenaId: "unknown" }), false);
assert.equal(isJoinPayload({ name: "玩家", characterId: "hat", roomCode: 123 }), false);
assert.equal(isJoinPayload({ name: "玩家", characterId: "not-a-character" }), false);
assert.equal(isJoinPayload({ name: 123, characterId: "hat" }), false);
assert.equal(isJoinPayload(null), false);

assert.equal(normalizeRoomCode(), DEFAULT_ROOM_CODE);
assert.equal(normalizeRoomCode(" arena1 "), "ARENA1");
assert.equal(normalizeRoomCode("abc"), null);
assert.equal(normalizeRoomCode("room-with-symbol"), null);
assert.equal(normalizeRoomCode("1234567890123"), null);

assert.equal(isClientAction({ type: "start" }), true);
assert.equal(isClientAction({ type: "move", x: 10, y: 20 }), true);
assert.equal(isClientAction({ type: "selectArena", arenaId: "moon-garden" }), true);
assert.equal(isClientAction({ type: "selectArena", arenaId: "unknown" }), false);
assert.equal(getArenaStage(0), "teach");
assert.equal(getArenaStage(6), "test");
assert.equal(getArenaStage(16), "twist");
assert.equal(getArenaStage(30), "mastery");
assert.equal(isClientAction({ type: "move", x: Number.NaN, y: 20 }), false);
assert.equal(isClientAction(null), false);
assert.equal(isClientAction({ type: "unknown" }), false);

const room = new GameRoom(() => undefined);
assert.equal(room.addPlayer("one", "A", "hat", "moon-garden"), true);
assert.equal(room.getSnapshot().arenaId, "moon-garden");
assert.equal(room.getSnapshot().arenaStage, "teach");
assert.equal(room.addPlayer("two", "B", "gauntlet"), true);
assert.equal(
  room.addPlayer("invalid", 123 as unknown as string, "spike"),
  false,
);

room.handleAction("one", { type: "start" });
assert.equal(room.getSnapshot().phase, "countdown");

room.removePlayer("two");
const afterDisconnect = room.getSnapshot();
assert.equal(afterDisconnect.phase, "lobby");
assert.equal(afterDisconnect.roomCount, 1);
assert.equal(afterDisconnect.countdownSec, null);

room.handleAction("one", null as unknown as never);

console.log("server tests passed");
