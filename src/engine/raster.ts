/**
 * A grid-resolution buffer: one value per Pixel Field cell, in two channels.
 *   ink — ordinary pixels (drawn in the section's pixel color)
 *   acc — highlighted pixels (drawn in the section's accent color)
 *
 * Scenes may write into `ink` / `acc` directly, or draw vector shapes with the
 * 2D context from `begin()` and then `commit()` them. Vector drawing happens at
 * grid resolution, so anti-aliasing turns partial coverage into mid-tones —
 * which the halftone renderer turns into smaller squares.
 */
export class Raster {
  w = 0;
  h = 0;
  ink = new Float32Array(0);
  acc = new Float32Array(0);
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ink = new Float32Array(w * h);
    this.acc = new Float32Array(w * h);
  }

  clear() {
    this.ink.fill(0);
    this.acc.fill(0);
  }

  /** Start a vector pass. Use `INK(a)` / `ACC(a)` as fill or stroke styles. */
  begin(): CanvasRenderingContext2D {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    return g;
  }

  /** Merge the vector pass into the channels (max blend). */
  commit() {
    const { w, h, ink, acc } = this;
    if (!w || !h) return;
    const d = this.g.getImageData(0, 0, w, h).data;
    for (let i = 0, j = 0; i < ink.length; i++, j += 4) {
      const r = d[j] / 255;
      const gch = d[j + 1] / 255;
      if (r > ink[i]) ink[i] = r;
      if (gch > acc[i]) acc[i] = gch;
    }
  }

  /** Add to a cell (clamped), for direct per-cell painting. */
  add(x: number, y: number, v: number, accent = false) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const ch = accent ? this.acc : this.ink;
    ch[i] = Math.min(1, ch[i] + v);
  }

  set(x: number, y: number, v: number, accent = false) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const ch = accent ? this.acc : this.ink;
    if (v > ch[i]) ch[i] = v;
  }
}

export const INK = (a = 1) => `rgba(255,0,0,${a})`;
export const ACC = (a = 1) => `rgba(0,255,0,${a})`;
