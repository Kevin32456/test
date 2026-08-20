/** Fusion Pixel 12px Proportional — zh_hant（繁體） */
export const PIXEL_FONT_FAMILY = '"Fusion Pixel 12px TC", monospace';

/** 12px 點陣字請用 12 的倍數，避免模糊 */
export const PIXEL_FONT_SIZES = {
  xs: 12,
  sm: 12,
  md: 24,
  lg: 36,
  xl: 48,
  countdown: 72,
} as const;

export const pixelTextStyle = (sizePx: number, extra: Record<string, unknown> = {}) => ({
  fontFamily: PIXEL_FONT_FAMILY,
  fontSize: `${sizePx}px`,
  ...extra,
});
