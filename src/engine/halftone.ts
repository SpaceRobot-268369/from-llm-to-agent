/**
 * Halftone renderer: turns per-cell intensities into quantized marks.
 *
 * Each cell is drawn at one of five sizes (LEVELS). Values between two levels
 * are ordered-dithered with a 4×4 Bayer matrix, which produces the checker and
 * dot textures of print halftone. Level 4 fills the whole cell, so dense areas
 * merge into solid pixel blocks.
 *
 * Mid-tone cells take the chapter's MARK shape, so each chapter has its own
 * texture: 0 = square (Model), 1 = dash (Memory, like lines of text),
 * 2 = cross (Harness). Solid cells are always full squares.
 *
 * Each cell also has a TONE: 0 = ink, 1 = accent, 2 + k = vivid colour k
 * (TONE_VIVID; see VIVID in color.ts). One path per tone actually used.
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const LEVELS = [0, 0.24, 0.42, 0.64, 1];
const STEPS = LEVELS.length - 1;

export const MARK = { square: 0, dash: 1, cross: 2 } as const;

/** per-cell tone: ink, accent, then the vivid colours from TONE_VIVID on */
export const TONE_INK = 0;
export const TONE_ACC = 1;
export const TONE_VIVID = 2;

export type HalftoneInput = {
  ctx: CanvasRenderingContext2D;
  values: Float32Array; // final intensity 0..1
  tones: Uint8Array; // per-cell colour: TONE_INK, TONE_ACC, or TONE_VIVID + k
  marks: Uint8Array; // per-cell mark shape (MARK)
  w: number;
  h: number;
  cell: number; // device px
  offX: number; // device px
  offY: number;
  /** css colour per tone: [ink, accent, ...vivid] */
  colors: readonly string[];
};

export function drawHalftone(o: HalftoneInput) {
  const { ctx, values, tones, marks, w, h, cell, offX, offY } = o;
  const paths: (Path2D | undefined)[] = [];
  const sizes = LEVELS.map((l, i) => (i === STEPS ? cell : Math.max(1, Math.round(l * cell))));
  // dash: wider than tall; cross: arms of the square's size, ~38% thick
  const dashH = Math.max(1, Math.round(cell * 0.3));
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const by = (y & 3) << 2;
    const py0 = offY + y * cell;
    for (let x = 0; x < w; x++) {
      const v = values[row + x];
      if (v < 0.02) continue;
      const f = (v > 1 ? 1 : v) * STEPS;
      let lvl = f | 0;
      if (f - lvl > BAYER[by | (x & 3)]) lvl++;
      if (lvl <= 0) continue;
      if (lvl > STEPS) lvl = STEPS;
      const tone = tones[row + x];
      const path = paths[tone] ?? (paths[tone] = new Path2D());
      const px0 = offX + x * cell;
      if (lvl === STEPS) {
        // full cell: snap both edges so neighbours tile without seams
        const px = Math.round(px0);
        const py = Math.round(py0);
        path.rect(px, py, Math.round(px0 + cell) - px, Math.round(py0 + cell) - py);
        continue;
      }
      const s = sizes[lvl];
      const mark = marks[row + x];
      if (mark === 1) {
        // dash: a short horizontal stroke, length grows with intensity
        const len = Math.min(cell, Math.round(s * 1.5));
        path.rect(Math.round(px0 + (cell - len) / 2), Math.round(py0 + (cell - dashH) / 2), len, dashH);
      } else if (mark === 2 && s >= 3) {
        // cross: two bars through the centre
        const t = Math.max(1, Math.round(s * 0.38));
        const cx = Math.round(px0 + (cell - s) / 2);
        const cy = Math.round(py0 + (cell - s) / 2);
        const m = Math.round((s - t) / 2);
        path.rect(cx, cy + m, s, t);
        path.rect(cx + m, cy, t, m);
        path.rect(cx + m, cy + m + t, t, s - m - t);
      } else {
        const pad = (cell - s) / 2;
        path.rect(Math.round(px0 + pad), Math.round(py0 + pad), s, s);
      }
    }
  }
  for (let k = 0; k < paths.length; k++) {
    const path = paths[k];
    if (!path) continue;
    ctx.fillStyle = o.colors[k] ?? o.colors[TONE_INK];
    ctx.fill(path);
  }
}
