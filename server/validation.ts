import type { ClientAction, JoinPayload } from "../src/shared/types.js";
import { isValidArenaId } from "../src/shared/arenas.js";
import { isValidCharacterId } from "../src/shared/characters.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isJoinPayload(value: unknown): value is JoinPayload {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.characterId === "string" &&
    isValidCharacterId(value.characterId) &&
    (value.roomCode === undefined || typeof value.roomCode === "string") &&
    (value.arenaId === undefined || isValidArenaId(value.arenaId))
  );
}

export function isClientAction(value: unknown): value is ClientAction {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  switch (value.type) {
    case "start":
      return true;
    case "selectCharacter":
      return typeof value.characterId === "string";
    case "selectArena":
      return isValidArenaId(value.arenaId);
    case "move":
    case "moveInput":
    case "blink":
      return isFiniteNumber(value.x) && isFiniteNumber(value.y);
    case "pass":
      return typeof value.targetId === "string";
    default:
      return false;
  }
}
