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
  DOG_BASE_SPEED: 155,
  DOG_ACCEL_PER_SEC: 42,
  DOG_MAX_SPEED: 600,
  /** 狗追擊點：玩家移動方向前方偏移（像素） */
  DOG_CHASE_FRONT_OFFSET: 22,
  /** 前向抓地力：沿當前速度方向加減速 */
  DOG_FORWARD_GRIP: 8.2,
  /** 速度向量最大轉向角速度（弧度/秒）— 越小越難急轉、甩尾越長 */
  DOG_TURN_RATE: 3.6,
  /** 追擊方向與速度夾角 >90° 時，轉向速率再縮放（傳球反向甩尾） */
  DOG_SHARP_TURN_SCALE: 0.38,
  /** 大角度轉向時加減速縮放，保留橫向慣性 */
  DOG_SHARP_TURN_GRIP_SCALE: 0.3,
  /** 側向摩擦：越小甩尾越長（越像冰面） */
  DOG_LATERAL_FRICTION: 0.18,
  /** 撞牆後速度保留比例 */
  DOG_WALL_SLIDE: 0.48,
  /** 傳球接球後保留的狗壓力比例 */
  DOG_PRESSURE_PASS_RETAIN: 0.8,
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

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const normalizeAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);
