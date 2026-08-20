import { PIXEL_FONT_FAMILY, PIXEL_FONT_SIZES } from "@shared/fonts";

const sizes = [
  PIXEL_FONT_SIZES.xs,
  PIXEL_FONT_SIZES.md,
  PIXEL_FONT_SIZES.xl,
  PIXEL_FONT_SIZES.countdown,
];

let loadPromise: Promise<void> | null = null;

export function loadPixelFont(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!("fonts" in document)) return;
    await Promise.all(
      sizes.map((size) => document.fonts.load(`400 ${size}px ${PIXEL_FONT_FAMILY}`)),
    );
    await document.fonts.ready;
  })();

  return loadPromise;
}
