import type { Box } from './scenes/types';

export const BASE_CELL_DESKTOP = 9;
export const BASE_CELL_MOBILE = 7;

/** Which side the diagram sits on during the READ phase ('center' = the hero). */
export type Side = 'left' | 'right' | 'center';

type Rect = [number, number, number, number]; // x, y, w, h as fractions of the viewport

const DESKTOP_SIDE: Record<'left' | 'right', Rect> = {
  right: [0.52, 0.13, 0.42, 0.74],
  left: [0.06, 0.13, 0.42, 0.74],
};
/** the hero frames its centred headline on every screen size */
const CENTER: Rect = [0.015, 0.06, 0.95, 0.92];

/**
 * The hero headline's region (fractions of the viewport), measured by the
 * Hero component from the real text and read by the hero scene, so the pixel
 * boxes frame the headline without ever touching it.
 */
export const heroHole = { x: 0.24, y: 0.28, w: 0.52, h: 0.44 };
/** WATCH phase: centred and large; the bottom strip is left for captions */
const DESKTOP_FOCUS: Rect = [0.08, 0.075, 0.84, 0.72];
/** mobile: the art always stays in the top band (no focus glide) */
const MOBILE_SIDE: Rect = [0.05, 0.075, 0.9, 0.37];

export function makeBox(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, s: Math.min(w, h) };
}

/** The art region in CSS px, interpolated from the side box to the focus box. */
export function artRect(W: number, H: number, mobile: boolean, side: Side = 'right', focus = 0): Rect {
  if (side === 'center') return [CENTER[0] * W, CENTER[1] * H, CENTER[2] * W, CENTER[3] * H];
  if (mobile) return [MOBILE_SIDE[0] * W, MOBILE_SIDE[1] * H, MOBILE_SIDE[2] * W, MOBILE_SIDE[3] * H];
  const a = DESKTOP_SIDE[side];
  const b = DESKTOP_FOCUS;
  const f = focus;
  return [
    (a[0] + (b[0] - a[0]) * f) * W,
    (a[1] + (b[1] - a[1]) * f) * H,
    (a[2] + (b[2] - a[2]) * f) * W,
    (a[3] + (b[3] - a[3]) * f) * H,
  ];
}

/** Grid geometry for a viewport and cell size. */
export function grid(W: number, H: number, cell: number) {
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  const offX = (W - cols * cell) / 2;
  const offY = (H - rows * cell) / 2;
  return { cols, rows, offX, offY, full: makeBox(0, 0, cols, rows) };
}

/** A CSS-px rect → grid units for a given grid. */
export function toGrid(rect: Rect, cell: number, offX: number, offY: number): Box {
  const [x, y, w, h] = rect;
  return makeBox((x - offX) / cell, (y - offY) / cell, w / cell, h / cell);
}
