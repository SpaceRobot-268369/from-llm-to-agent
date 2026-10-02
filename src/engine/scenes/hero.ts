/**
 * hero — the model in many boxes. A compact band of concentric pixel frames
 * hugs the centred headline (its region comes from heroHole, measured by the
 * Hero component, which also decides how many rings fit between the headline
 * and the HUD and scatters the stickers outside the band). The inner frame
 * carries accent corner brackets; the core stays empty — the headline is the
 * model. Scrolling peels the boxes off outward, outermost first, each one
 * drifting out (never past the HUD-free margin) as it fades.
 */
import { HERO_RINGS, heroHole, heroRing } from '../layout';
import { easeInOut, range } from '../noise';
import type { Scene } from './types';
import { INK } from './helpers';

/** the peel: starts once every sticker is on its way in, ends at p = 1 */
const PEEL_START = 0.42;
const PEEL_SPAN = 0.22;
/** how far (cells) the outermost ring drifts as it goes, at most */
const DRIFT = 4;
/** ring tone, innermost first: exact halftone levels, so each ring is one even mark size (solid → fine dots) */
const TONE = [1, 0.75, 0.5, 0.25];
/** accent corner bracket arm length (cells) */
const ARM = 3;

const scene: Scene = {
  paint({ r, full, p }) {
    const n = Math.min(heroHole.rings, HERO_RINGS.length);
    if (n <= 0) return; // no room for the band: the headline stands alone
    const g = r.begin();
    const last = HERO_RINGS[n - 1];
    const drift = Math.min(heroHole.room, DRIFT);
    const step = n > 1 ? (1 - PEEL_START - PEEL_SPAN) / (n - 1) : 0;
    g.lineWidth = 1;
    let inner: [number, number, number, number] | null = null;
    for (let i = 0; i < n; i++) {
      // outermost first; each ring drifts out (inner ones travel farther) as it fades
      const a0 = PEEL_START + (n - 1 - i) * step;
      const k = range(a0, a0 + PEEL_SPAN, p);
      if (k >= 1) continue;
      const out = Math.round(easeInOut(k) * (drift + last - HERO_RINGS[i]));
      const [x0, y0, x1, y1] = heroRing(i, full.w, full.h, out);
      if (i === 0) inner = [x0, y0, x1, y1];
      g.strokeStyle = INK((TONE[i] ?? 0.25) * (1 - k));
      g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    }

    r.commit();

    // accent corner brackets on the innermost frame: the box the model sits in. They sit ON the
    // solid ring, so the ring's ink steps aside under them (and comes back as they fade)
    const ba = 1 - range(0.3, 0.6, p);
    if (inner && ba > 0.01) {
      const [bx0, by0, bx1, by1] = inner;
      const mark = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
        const i = y * r.w + x;
        r.ink[i] *= 1 - ba;
        if (ba > r.acc[i]) r.acc[i] = ba;
      };
      for (const [cx, cy, sx, sy] of [
        [bx0, by0, 1, 1],
        [bx1 - 1, by0, -1, 1],
        [bx0, by1 - 1, 1, -1],
        [bx1 - 1, by1 - 1, -1, -1],
      ] as const) {
        for (let k = 0; k < ARM; k++) mark(cx + sx * k, cy);
        for (let k = 1; k < ARM; k++) mark(cx, cy + sy * k);
      }
    }
  },
};

export default scene;
