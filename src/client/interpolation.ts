/** 指數平滑插值，deltaMs 為幀間隔毫秒 */
export function expLerp(
  current: number,
  target: number,
  deltaMs: number,
  speed: number,
): number {
  const t = 1 - Math.exp(-speed * (deltaMs / 1000));
  return current + (target - current) * t;
}

export function expLerpAngle(
  current: number,
  target: number,
  deltaMs: number,
  speed: number,
): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-speed * (deltaMs / 1000)));
}
