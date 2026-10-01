/**
 * window — the strip has a maximum length. A fixed, bright accent frame (the
 * context window) with a dimension line over it marking its capacity; below,
 * the model sees only what is inside the frame, through a dotted beam. The
 * token strip is already longer than the frame: scrolling types new tokens at
 * the cursor, the whole strip slides left, and the oldest tokens leave the
 * frame, dim, and crumble into falling dust.
 */
import { hash2, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, blink, space, strokeRound } from './helpers';
import { caret, edge, kit, token, tokenW } from './tokens';

/** tokens appended across the story beat */
const NADD = 9;
const P0 = 0.05;
const P1 = 0.75;
const SEED = 31;
/** at p = 0 the oldest token is this far into the dissolve zone (0..1) */
const OVERFLOW0 = 0.55;
/** light bands drifting down the beam */
const BANDS = 3;

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { th, gap, lw, cw } = kit(box, 1.35);
    const { L } = space(box);

    // ── geometry: dimension line, frame, beam, model ─────────────────────
    const left = Math.round(box.x + box.w * 0.07);
    const right = Math.round(box.x + box.w * 0.93);
    const fw = Math.round((right - left) * 0.6);
    const fx = right - fw;
    const zone = fx - left; // where the leaving tokens dissolve
    const fpad = Math.max(3, Math.round(th * 0.6));
    const fh = th + fpad * 2;
    const rulerGap = Math.max(4, Math.round(th * 1.4));
    const beamH = Math.round(L(0.68));
    const core = Math.max(3, Math.round(th * 1.1));
    const ringHalf = Math.round(core / 2 + Math.max(1, Math.round(core * 0.4)) + lw);
    const totalH = rulerGap + fh + beamH + ringHalf * 2;
    const fy = Math.round(box.cy - totalH / 2 + rulerGap);
    const innerL = fx + fpad;
    const innerR = fx + fw - fpad;
    const e = edge(lw);

    // dimension line over the frame: |———— max length ————|
    const ry = fy - rulerGap;
    const tk = Math.max(1, Math.round(th * 0.45));
    g.fillStyle = INK(0.55);
    g.fillRect(fx, ry, fw, 1);
    g.fillStyle = INK(0.85);
    g.fillRect(fx, ry - tk, 1, tk * 2 + 1);
    g.fillRect(fx + fw - 1, ry - tk, 1, tk * 2 + 1);

    // the model below sees exactly the frame's contents: a dotted beam
    const mx = Math.round(fx + fw / 2);
    const my = fy + fh + beamH + ringHalf;
    const b0 = fy + fh + 1;
    const b1 = my - ringHalf - 1;
    g.save();
    g.beginPath();
    g.moveTo(fx + 1, b0);
    g.lineTo(fx + fw - 1, b0);
    g.lineTo(mx + ringHalf - 1, b1);
    g.lineTo(mx - ringHalf + 1, b1);
    g.closePath();
    g.fillStyle = INK(0.13);
    g.fill();
    g.clip();
    // bands drift from the window down into the model (ambient)
    g.fillStyle = INK(0.17);
    for (let k = 0; k < BANDS; k++) {
      const ph = (t * 0.22 + k / BANDS) % 1;
      g.fillRect(fx, Math.round(b0 + ph * (b1 - b0)) - 1, fw, 2);
    }
    g.restore();
    strokeRound(g, mx - ringHalf + e, my - ringHalf + e, ringHalf * 2 - e * 2, ringHalf * 2 - e * 2, 0.5, lw, INK(0.7));
    const c0 = Math.round(mx - core / 2);
    g.fillStyle = INK(1);
    g.fillRect(c0, Math.round(my - core / 2), core, core);

    // ── the strip ────────────────────────────────────────────────────────
    // longer than the window from the start: find how many tokens that takes
    const W: number[] = [];
    const S: number[] = [0];
    const need = innerR - (fx - zone * OVERFLOW0) - cw;
    let n0 = 0;
    while (S[n0] < need) {
      W.push(tokenW(n0, SEED, th));
      S.push(S[n0] + W[n0] + gap);
      n0++;
    }
    for (let i = n0; i <= n0 + NADD; i++) {
      W.push(tokenW(i, SEED, th));
      S.push(S[i] + W[i] + gap);
    }
    const n = n0 + range(P0, P1, p) * NADD;
    const whole = Math.floor(n);
    // the newest token types in from nothing
    const grow = Math.round((n - whole) * (W[whole] + gap));
    const len = S[whole] + grow + cw;
    // whole-cell steps keep the blocks crisp while the strip slides
    const ox = Math.min(innerL, innerR - len);
    const ty = fy + fpad;

    // inside the window: solid tokens (the part outside is dissolved below)
    g.save();
    g.beginPath();
    g.rect(fx, fy, fw, fh);
    g.clip();
    for (let i = 0; i < whole; i++) {
      const x = ox + S[i];
      if (x + W[i] <= fx) continue;
      token(g, x, ty, W[i], th, INK(0.9));
    }
    if (grow > gap) token(g, ox + S[whole], ty, grow - gap, th, INK(0.9));
    g.restore();
    caret(g, ox + len - cw, ty, th, cw, blink(t));

    // the window itself: fixed, bright — always a crisp 2-cell stroke
    const flw = Math.max(2, lw);
    const fe = edge(flw);
    strokeRound(g, fx + fe, fy + fe, fw - fe * 2, fh - fe * 2, th * 0.6, flw, ACC(1));

    r.commit();

    // ── dissolve: tokens that left the window dim, crumble, and fall ─────
    const fallMax = th * 2.6;
    const twinkle = Math.floor(t * 5);
    const rounded = th >= 4;
    for (let i = 0; i < whole; i++) {
      const x = ox + S[i];
      if (x >= fx) break;
      for (let c = 0; c < W[i]; c++) {
        const cx = x + c;
        if (cx >= fx) break;
        const d = (fx - cx - 0.5) / zone;
        if (d >= 1) continue;
        const sx = S[i] + c;
        const edgeCol = c === 0 || c === W[i] - 1;
        for (let rr = 0; rr < th; rr++) {
          if (rounded && edgeCol && (rr === 0 || rr === th - 1)) continue;
          const h = hash2(sx, rr, SEED);
          if (h < Math.pow(d, 1.4)) continue;
          const loose = Math.max(0, d - 0.2) / 0.8;
          const py = ty + rr + Math.round(loose * loose * fallMax * (0.3 + 0.7 * hash2(sx, rr, SEED + 1)));
          const px = cx - Math.round(loose * loose * 2 * hash2(sx, rr, SEED + 2));
          const tw = t > 0 && hash2(sx, rr, twinkle) > 0.82 ? 0.55 : 1;
          r.set(px, py, (0.1 + 0.5 * (1 - d)) * tw);
        }
      }
    }
  },
};

export default scene;
