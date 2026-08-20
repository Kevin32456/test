export const GAME = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS_TO_START: 2,
  ARENA_WIDTH: 900,
  ARENA_HEIGHT: 900,
  PLAYER_RADIUS: 18,
  PLAYER_SPEED: 220,
  BLINK_DISTANCE: 140,
  BLINK_COOLDOWN_MS: 3000,
  DOG_RADIUS: 22,
  DOG_BASE_SPEED: 200,
  DOG_ACCEL_PER_SEC: 32,
  DOG_MAX_SPEED: 500,
  /** 弧度/秒 — 越小甩尾越明顯 */
  DOG_MAX_TURN_RATE: 2.8,
  TICK_HZ: 20,
  COUNTDOWN_SECONDS: 3,
  COLORS: ["#4fc3f7", "#81c784", "#ffb74d", "#e57373"],
} as const;

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const normalizeAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);
