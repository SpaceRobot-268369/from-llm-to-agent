/**
 * hero — the model in many boxes. Concentric pixel rectangles frame the
 * centred headline (its region comes from heroHole, measured by the Hero
 * component), stepping out from just around the text to the screen edges;
 * the inner frame carries accent corner brackets. The core stays empty — the
 * headline is the model. Scrolling peels the boxes off outward.
 */
import { heroHole } from '../layout';
import { easeInOut, lerp, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK } from './helpers';

const COUNT = 7;

const scene: Scene = {
  paint({ r, box, full, p }) {
    const g = r.begin();
    // the headline hole in grid units (+1 cell of air)
    const hx0 = Math.floor(heroHole.x * full.w) - 1;
    const hy0 = Math.floor(heroHole.y * full.h) - 1;
    const hx1 = Math.ceil((heroHole.x + heroHole.w) * full.w) + 1;
    const hy1 = Math.ceil((heroHole.y + heroHole.h) * full.h) + 1;
    const ox0 = Math.ceil(box.x) + 1;
    const oy0 = Math.ceil(box.y) + 1;
    const ox1 = Math.floor(box.x + box.w) - 1;
    const oy1 = Math.floor(box.y + box.h) - 1;
    // narrow screens: keep at least a thin margin of frames around the hole
    const hl = Math.min(hx0, ox0 + 2);
    const hr = Math.max(hx1, ox1 - 2);
    if (hy1 >= oy1 - 2) {
      r.commit();
      return;
    }
    const useX0 = hx0 > ox0 + 2 ? hx0 : hl;
    const useX1 = hx1 < ox1 - 2 ? hx1 : hr;

    const peel = easeInOut(range(0.3, 1, p));
    const keep = COUNT * (1 - range(0.4, 1, p));
    for (let i = 1; i <= COUNT; i++) {
      if (i > Math.ceil(keep)) continue;
      const fade = i === Math.ceil(keep) && keep % 1 > 0 ? keep % 1 : 1;
      // spacing grows outward, like ripples
      const k = Math.pow(i / COUNT, 1.25);
      const out = peel * k * 14;
      const x0 = Math.round(lerp(useX0, ox0, k) - out);
      const y0 = Math.round(lerp(hy0, oy0, k) - out);
      const x1 = Math.round(lerp(useX1, ox1, k) + out);
      const y1 = Math.round(lerp(hy1, oy1, k) + out);
      const a = (0.95 - 0.5 * (i / COUNT)) * fade;
      g.lineWidth = 1;
      g.strokeStyle = INK(a);
      g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    }

    // accent corner brackets on the innermost frame: the box the model sits in
    const k1 = Math.pow(1 / COUNT, 1.25);
    const bx0 = Math.round(lerp(useX0, ox0, k1));
    const by0 = Math.round(lerp(hy0, oy0, k1));
    const bx1 = Math.round(lerp(useX1, ox1, k1));
    const by1 = Math.round(lerp(hy1, oy1, k1));
    const arm = 3;
    const ba = 1 - range(0.3, 0.6, p);
    if (ba > 0.01) {
      g.fillStyle = ACC(ba);
      for (const [cx, cy, sx, sy] of [
        [bx0, by0, 1, 1],
        [bx1 - 1, by0, -1, 1],
        [bx0, by1 - 1, 1, -1],
        [bx1 - 1, by1 - 1, -1, -1],
      ] as const) {
        g.fillRect(sx > 0 ? cx : cx - arm + 1, cy, arm, 1);
        g.fillRect(cx, sy > 0 ? cy : cy - arm + 1, 1, arm);
      }
    }
    r.commit();
  },
};

export default scene;
