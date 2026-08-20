export type GamePhase = "lobby" | "countdown" | "playing" | "ended";

export interface PlayerState {
  id: string;
  name: string;
  characterId: string;
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
  vx: number;
  vy: number;
}

export interface BallState {
  x: number;
  y: number;
  inFlight: boolean;
  targetPlayerId: string | null;
}

export interface GameSnapshot {
  phase: GamePhase;
  matchSeq: number;
  players: PlayerState[];
  dog: DogState;
  ball: BallState;
  ballHolderId: string | null;
  holdTimeSec: number;
  /** 狗當前追擊壓力（持球累積；傳球飛行中凍結） */
  dogPressureSec: number;
  countdownSec: number | null;
  winnerId: string | null;
  winnerName: string | null;
  roomCount: number;
}

export type ClientAction =
  | { type: "move"; x: number; y: number }
  | { type: "moveInput"; x: number; y: number }
  | { type: "pass"; targetId: string }
  | { type: "blink"; x: number; y: number }
  | { type: "selectCharacter"; characterId: string }
  | { type: "start" };

export interface JoinPayload {
  name: string;
  characterId: string;
}

export interface JoinedPayload {
  playerId: string;
  snapshot: GameSnapshot;
}
