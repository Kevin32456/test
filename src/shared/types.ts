export type GamePhase = "lobby" | "countdown" | "playing" | "ended";

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alive: boolean;
  hasBall: boolean;
  blinkCooldownMs: number;
}

export interface DogState {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  players: PlayerState[];
  dog: DogState;
  ballHolderId: string | null;
  holdTimeSec: number;
  countdownSec: number | null;
  winnerId: string | null;
  winnerName: string | null;
  roomCount: number;
}

export type ClientAction =
  | { type: "move"; x: number; y: number }
  | { type: "pass"; targetId: string }
  | { type: "blink"; x: number; y: number }
  | { type: "start" };

export interface JoinPayload {
  name: string;
}

export interface JoinedPayload {
  playerId: string;
  snapshot: GameSnapshot;
}
