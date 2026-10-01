/**
 * Halftone renderer: turns per-cell intensities into quantized squares.
 *
 * Each cell is drawn at one of five sizes (LEVELS). Values between two levels
 * are ordered-dithered with a 4×4 Bayer matrix, which produces the checker and
 * dot textures of print halftone. Level 4 fills the whole cell, so dense areas
 * merge into solid pixel blocks.
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const LEVELS = [0, 0.24, 0.42, 0.64, 1];
const STEPS = LEVELS.length - 1;

export type HalftoneInput = {
  ctx: CanvasRenderingContext2D;
  values: Float32Array; // final intensity 0..1
  accent: Uint8Array; // 1 = draw in accent color
  w: number;
  h: number;
  cell: number; // device px
  offX: number; // device px
  offY: number;
  inkColor: string;
  accColor: string;
};

export function drawHalftone(o: HalftoneInput) {
  const { ctx, values, accent, w, h, cell, offX, offY } = o;
  const inkPath = new Path2D();
  const accPath = new Path2D();
  const sizes = LEVELS.map((l, i) => (i === STEPS ? cell : Math.max(1, Math.round(l * cell))));
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
      const s = sizes[lvl];
      const px0 = offX + x * cell;
      let px: number, py: number, sw: number;
      if (lvl === STEPS) {
        // full cell: snap both edges so neighbours tile without seams
        px = Math.round(px0);
        py = Math.round(py0);
        sw = Math.round(px0 + cell) - px;
        const sh = Math.round(py0 + cell) - py;
        (accent[row + x] ? accPath : inkPath).rect(px, py, sw, sh);
        continue;
      }
      const pad = (cell - s) / 2;
      px = Math.round(px0 + pad);
      py = Math.round(py0 + pad);
      (accent[row + x] ? accPath : inkPath).rect(px, py, s, s);
    }
  }
  ctx.fillStyle = o.inkColor;
  ctx.fill(inkPath);
  ctx.fillStyle = o.accColor;
  ctx.fill(accPath);
}
