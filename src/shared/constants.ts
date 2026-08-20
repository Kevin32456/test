export const GAME = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS_TO_START: 2,
  ARENA_WIDTH: 900,
  ARENA_HEIGHT: 900,
  /** 圓形競技場半徑（中心為 ARENA 正中央） */
  ARENA_RADIUS: 420,
  PLAYER_RADIUS: 18,
  PLAYER_SPEED: 245,
  BLINK_DISTANCE: 160,
  BLINK_COOLDOWN_MS: 2800,
  DOG_RADIUS: 22,
  DOG_BASE_SPEED: 120,
  DOG_ACCEL_PER_SEC: 22,
  DOG_MAX_SPEED: 410,
  /** 狗追擊點：玩家移動方向前方偏移（像素）— 越大越容易被繞背 */
  DOG_CHASE_FRONT_OFFSET: 42,
  /** 前向抓地力：沿當前速度方向加減速 */
  DOG_FORWARD_GRIP: 5.0,
  /** 速度向量最大轉向角速度（弧度/秒）— 越小越難急轉、甩尾越長 */
  DOG_TURN_RATE: 2.0,
  /** 追擊方向與速度夾角 >90° 時，轉向速率再縮放（傳球反向甩尾） */
  DOG_SHARP_TURN_SCALE: 0.2,
  /** 大角度轉向時加減速縮放，保留橫向慣性 */
  DOG_SHARP_TURN_GRIP_SCALE: 0.16,
  /** 側向摩擦：越小甩尾越長（越像冰面） */
  DOG_LATERAL_FRICTION: 0.08,
  /** 撞牆後速度保留比例 */
  DOG_WALL_SLIDE: 0.48,
  /** 傳球接球後保留的狗壓力比例 */
  DOG_PRESSURE_PASS_RETAIN: 0.5,
  TICK_HZ: 20,
  /** 客戶端插值平滑係數（越大越貼近伺服器） */
  CLIENT_LERP: 14,
  /** 狗視覺插值（略低較能呈現滑動感） */
  CLIENT_DOG_LERP: 7,
  COUNTDOWN_SECONDS: 3,
  LOBBY_RESET_MS: 5000,
  BALL_RADIUS: 8,
  BALL_HOVER_OFFSET: 28,
  BALL_FLIGHT_SPEED: 540,
  BALL_ARRIVE_DIST: 14,
  COLORS: ["#4fc3f7", "#81c784", "#ffb74d", "#e57373"],
} as const;

export const arenaCenter = () => ({
  x: GAME.ARENA_WIDTH / 2,
  y: GAME.ARENA_HEIGHT / 2,
});

/** 將實體限制在圓形競技場內 */
export const clampToArena = (x: number, y: number, entityRadius: number) => {
  const c = arenaCenter();
  const maxR = GAME.ARENA_RADIUS - entityRadius;
  const dx = x - c.x;
  const dy = y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxR || dist < 0.001) return { x, y };
  const scale = maxR / dist;
  return { x: c.x + dx * scale, y: c.y + dy * scale };
};

/** 圓形邊界碰撞：推回場內並沿切線滑動 */
export const slideCircleWall = (
  x: number,
  y: number,
  vx: number,
  vy: number,
  entityRadius: number,
  slide: number,
) => {
  const c = arenaCenter();
  const maxR = GAME.ARENA_RADIUS - entityRadius;
  const dx = x - c.x;
  const dy = y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxR) return { x, y, vx, vy };

  const nx = dx / dist;
  const ny = dy / dist;
  const px = c.x + nx * maxR;
  const py = c.y + ny * maxR;
  const vDotN = vx * nx + vy * ny;
  let nvx = vx;
  let nvy = vy;
  if (vDotN > 0) {
    nvx = (vx - vDotN * nx) * slide;
    nvy = (vy - vDotN * ny) * slide;
  }
  return { x: px, y: py, vx: nvx, vy: nvy };
};

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const normalizeAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);
