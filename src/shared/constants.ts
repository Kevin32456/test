export const GAME = {
  MAX_PLAYERS: 8,
  MIN_PLAYERS_TO_START: 2,
  ARENA_WIDTH: 900,
  ARENA_HEIGHT: 900,
  /** 圓形競技場半徑（中心為 ARENA 正中央） */
  ARENA_RADIUS: 420,
  PLAYER_RADIUS: 18,
  /** 玩家被狗命中的有效半徑；獨立於移動／邊界碰撞 */
  PLAYER_HIT_RADIUS: 13,
  PLAYER_SPEED: 300,
  BLINK_DISTANCE: 160,
  BLINK_COOLDOWN_MS: 2800,
  DOG_RADIUS: 22,
  /** 狗造成擊殺的有效半徑；依 sprite 短軸調整 */
  DOG_HIT_RADIUS: 16,
  DOG_BASE_SPEED: 135,
  DOG_ACCEL_PER_SEC: 46,
  /** HUD 壓力條滿格對應秒數（實際狗速與壓力無上限） */
  DOG_PRESSURE_BAR_SEC: 10,
  /** 狗追擊點：近距離時的前方偏移（繞圈卡位用） */
  DOG_CHASE_FRONT_OFFSET: 12,
  /** 超過此距離改追玩家本體，不再用前方偏移 */
  DOG_CHASE_RECOVERY_DIST: 105,
  /** 近距離繞圈區間（與 recovery 之間線性混合） */
  DOG_ORBIT_RANGE: 72,
  /** 落後追擊時的速度加成（最多 +18%） */
  DOG_CATCHUP_SPEED_BONUS: 0.18,
  /** 繞圈時轉向速率（低 = 甩尾感） */
  DOG_ORBIT_TURN_RATE: 1.72,
  /** 落後追回時轉向速率 */
  DOG_TURN_RATE: 2.85,
  /** 狗頭平常朝向球的轉速（與位移慣性分離） */
  DOG_FACING_TURN_RATE: 10,
  /** 球位於狗後方時，狗頭快速回看的轉速 */
  DOG_SHARP_FACING_TURN_RATE: 16,
  /** 掠過球後反向牽引速度的強度；越高折返距離越短 */
  DOG_REVERSE_GRIP: 5.5,
  /** 繞圈時前向抓地力（低 = 速度慣性、外甩） */
  DOG_ORBIT_FORWARD_GRIP: 5.0,
  /** 落後追回時前向抓地力 */
  DOG_FORWARD_GRIP: 9.2,
  /** 追擊方向與速度夾角 >90° 時，轉向速率再縮放（傳球反向甩尾） */
  DOG_SHARP_TURN_SCALE: 0.36,
  /** 大角度轉向時加減速縮放，保留橫向慣性 */
  DOG_SHARP_TURN_GRIP_SCALE: 0.20,
  /** 側向摩擦（僅大角度／追回時啟用） */
  DOG_LATERAL_FRICTION: 0.10,
  /** 撞牆後速度保留比例 */
  DOG_WALL_SLIDE: 0.48,
  /** 傳球接球後保留的狗壓力比例（飛行中壓力凍結，落地才結算） */
  DOG_PRESSURE_PASS_RETAIN: 0.85,
  TICK_HZ: 20,
  /** 客戶端插值平滑係數（越大越貼近伺服器） */
  CLIENT_LERP: 14,
  /** 狗視覺插值（略低較能呈現滑動感） */
  CLIENT_DOG_LERP: 5,
  COUNTDOWN_SECONDS: 3,
  /** 玩家死亡後全場凍結、公告死者的時間 */
  DEATH_PAUSE_MS: 2000,
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
