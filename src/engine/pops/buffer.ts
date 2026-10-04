/**
 * The pops' paint target: one value per Pixel Field cell, like a Raster, in
 * three channels:
 *   ink  — drawn in the section's pixel colour
 *   acc  — drawn in its accent colour
 *   hole — 0..1: thins whatever the scene, dust and halo drew under the cell
 *          (a shockwave can push the field aside)
 * Pops stamp cells directly (no vector pass), so the buffer needs no DOM.
 * It tracks the bounding box of everything written, so clearing and merging
 * touch only the cells the pops reached.
 */
export class PopBuffer {
  w = 0;
  h = 0;
  ink = new Float32Array(0);
  acc = new Float32Array(0);
  hole = new Float32Array(0);
  /** written cells: [x0, x1) × [y0, y1); empty when x0 >= x1 */
  x0 = 0;
  y0 = 0;
  x1 = 0;
  y1 = 0;

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.ink = new Float32Array(w * h);
    this.acc = new Float32Array(w * h);
    this.hole = new Float32Array(w * h);
    this.x0 = this.y0 = this.x1 = this.y1 = 0;
  }

  clear() {
    const { w, x0, x1, y0, y1 } = this;
    for (let y = y0; y < y1; y++) {
      const a = y * w + x0;
      const b = y * w + x1;
      this.ink.fill(0, a, b);
      this.acc.fill(0, a, b);
      this.hole.fill(0, a, b);
    }
    this.x0 = this.y0 = this.x1 = this.y1 = 0;
  }

  get empty(): boolean {
    return this.x0 >= this.x1;
  }

  /** the cell index for grid point (x, y), or -1 off the grid; grows the written box */
  private at(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return -1;
    if (this.x0 >= this.x1) {
      this.x0 = xi;
      this.x1 = xi + 1;
      this.y0 = yi;
      this.y1 = yi + 1;
    } else {
      if (xi < this.x0) this.x0 = xi;
      else if (xi >= this.x1) this.x1 = xi + 1;
      if (yi < this.y0) this.y0 = yi;
      else if (yi >= this.y1) this.y1 = yi + 1;
    }
    return yi * this.w + xi;
  }

  /** Light the cell under (x, y) at v (0..1, max blend), in ink or accent. Off-grid points are ignored. */
  dot(x: number, y: number, v: number, accent = false) {
    if (!(v > 0)) return;
    const i = this.at(x, y);
    if (i < 0) return;
    const ch = accent ? this.acc : this.ink;
    const c = v > 1 ? 1 : v;
    if (c > ch[i]) ch[i] = c;
  }

  /** Knock out the field under (x, y) by v (0..1, max blend): the scene's mark there shrinks or vanishes. */
  punch(x: number, y: number, v: number) {
    if (!(v > 0)) return;
    const i = this.at(x, y);
    if (i < 0) return;
    const c = v > 1 ? 1 : v;
    if (c > this.hole[i]) this.hole[i] = c;
  }
}
