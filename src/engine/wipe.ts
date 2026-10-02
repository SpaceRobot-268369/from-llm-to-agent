/**
 * Transition geometry shared by the canvas (PixelField) and the DOM chrome
 * (the ticker writes it to CSS), so the top bar and the Top button split their
 * background at exactly the same place as the canvas during a chapter wipe.
 */

/** width of the dissolve / wipe front, in noise units */
export const EDGE = 0.28;

/** Where the background split sits during a chapter wipe, 0 → 1 across the width, for blend 0 → 1. */
export function wipeFront(blend: number): number {
  const k = blend * (1 + EDGE);
  return Math.max(0, Math.min(1, (k - EDGE / 2 - 0.09) / 0.82));
}
