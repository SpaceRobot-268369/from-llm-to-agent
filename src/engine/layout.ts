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
 * boxes frame the headline without ever touching it. Hero.tsx also decides
 * how many of HERO_RINGS fit between the headline and the HUD (`rings`) and
 * how far, in cells, the band may drift outward as it peels off (`room`), so
 * it can scatter the stickers outside the whole band.
 */
export const heroHole = { x: 0.24, y: 0.28, w: 0.52, h: 0.44, rings: 0, room: 0 };

/**
 * The hero's frames: a compact band hugging the headline. Each ring's offset
 * (cells) out from the headline, innermost first; the gaps grow like ripples.
 */
export const HERO_RINGS = [0, 2, 4, 7];

/**
 * Hero ring i in grid cells, [x0, y0, x1, y1) — its 1-cell line covers
 * columns x0 and x1 − 1, rows y0 and y1 − 1. `out` pushes it further out (the
 * scroll peel). Shared by the scene (to paint it) and Hero.tsx (to keep the
 * stickers and the HUD off the band).
 */
export function heroRing(i: number, cols: number, rows: number, out = 0): [number, number, number, number] {
  const d = 1 + HERO_RINGS[i] + out;
  return [
    Math.floor(heroHole.x * cols) - d,
    Math.floor(heroHole.y * rows) - d,
    Math.ceil((heroHole.x + heroHole.w) * cols) + d,
    Math.ceil((heroHole.y + heroHole.h) * rows) + d,
  ];
}
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
