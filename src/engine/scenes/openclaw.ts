/**
 * openclaw — the agent that never logs off. A big pixel lobster claw with a
 * halftone shine, chat bubbles around it (its channels: each a little
 * notification with an app badge) and a heartbeat monitor along the bottom.
 * Scrolling pops the channels in one by one, then the heartbeat wakes up:
 * on every beat the newest spike flashes accent at the write head, the claw
 * snaps, and one of the channels lights up with a fresh message.
 */
import { clamp, easeInOut, lerp, range, smoothstep } from '../noise';
import type { Scene } from './types';
import { ACC, INK, fillCircle, space, strokeRound, textLines } from './helpers';

/** Seconds between heartbeats. */
const PERIOD = 2.6;

/**
 * Two layouts in space() units — palm centre + claw size, and the four chat
 * bubbles — blended by how wide the art box is. Square-ish boxes keep the
 * claw left with the channels to its right; the wide WATCH box puts the claw
 * in the middle with channels on both sides. Bubbles 2 and 3 only cross
 * over while still hidden, so the blend never slides one through the claw.
 */
const SQUARE = {
  claw: [-0.28, -0.08, 0.38],
  bubbles: [
    [0.48, -0.66],
    [0.64, -0.2],
    [0.5, 0.3],
    [-0.6, -0.76],
  ],
};
const WIDE = {
  claw: [-0.1, -0.1, 0.38],
  bubbles: [
    [0.58, -0.62],
    [0.84, -0.06],
    [-0.86, 0.14],
    [-0.74, -0.58],
  ],
};
/** When each channel pops in (−1 = present from the start). */
const AT = [-1, 0.1, 0.18, 0.26];

/** One ECG beat, as (x in spike widths, y in amplitudes; negative = up). */
const BEAT: [number, number][] = [
  [-1.7, 0],
  [-1.4, -0.14],
  [-1.1, 0],
  [-0.4, 0],
  [-0.22, 0.2],
  [0, -1],
  [0.24, 0.42],
  [0.44, 0],
  [0.95, 0],
  [1.25, -0.24],
  [1.6, 0],
];

const easeOutBack = (x: number) => (x <= 0 ? 0 : 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2);

type G = CanvasRenderingContext2D;

/**
 * The claw's silhouette in claw units (palm centre near the origin, fingers
 * pointing up): a swollen palm, two thick curved fingers around a lens-shaped
 * gap, and a wrist segment below a joint gap. `bite` swings the movable
 * (left) finger about its hinge; positive closes it.
 */
function clawPath(g: G, bite: number) {
  // palm
  g.moveTo(0.56, 0.25);
  g.ellipse(0, 0.25, 0.56, 0.62, 0, 0, Math.PI * 2);
  // fixed finger (right)
  g.moveTo(0.56, 0.12);
  g.quadraticCurveTo(0.82, -0.8, 0.12, -1.3);
  g.quadraticCurveTo(0.3, -0.7, 0.06, -0.1);
  g.closePath();
  // movable finger (left), hinged at the palm's left shoulder
  g.save();
  g.translate(-0.45, 0);
  g.rotate(bite);
  g.translate(0.45, 0);
  g.moveTo(-0.56, 0.12);
  g.quadraticCurveTo(-0.82, -0.8, -0.12, -1.3);
  g.quadraticCurveTo(-0.3, -0.7, -0.06, -0.1);
  g.closePath();
  g.restore();
  // wrist, after a joint gap
  g.moveTo(0.28, 1.27);
  g.ellipse(-0.06, 1.27, 0.34, 0.24, 0.15, 0, Math.PI * 2);
}

/** Where the light catches the shell: these stay mid-tone inside the solid claw. */
function shine(g: G) {
  g.moveTo(-0.08, 0.05);
  g.ellipse(-0.22, 0.05, 0.14, 0.26, 0.4, 0, Math.PI * 2);
  g.moveTo(0.1, 1.22);
  g.ellipse(-0.02, 1.22, 0.12, 0.07, 0.15, 0, Math.PI * 2);
}

/** Channel badge glyphs (cousins of the MCP tool glyphs): dot, tile, plus, play. */
function badge(g: G, cx: number, cy: number, s: number, kind: number, style: string) {
  const h = s / 2;
  g.beginPath();
  if (kind === 0) g.arc(cx, cy, h, 0, Math.PI * 2);
  else if (kind === 1) g.roundRect(cx - h, cy - h, s, s, s * 0.3);
  else if (kind === 2) {
    const k = s * 0.2;
    g.rect(cx - k, cy - h, k * 2, s);
    g.rect(cx - h, cy - k, s, k * 2);
  } else {
    g.moveTo(cx - h * 0.8, cy - h);
    g.lineTo(cx + h, cy);
    g.lineTo(cx - h * 0.8, cy + h);
    g.closePath();
  }
  g.fillStyle = style;
  g.fill('nonzero');
}

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { X, Y, L } = space(box);
    const snap = (v: number) => Math.floor(v) + 0.5;
    // family vocabulary: one primary stroke, one card radius, 2-cell text rows
    const lw = Math.max(1.5, L(0.045));
    const rad = L(0.06);

    const awake = easeInOut(range(0.3, 0.5, p)); // heartbeat strengthens
    const beat = t / PERIOD;
    const phase = beat - Math.floor(beat); // 0 = an R-peak is at the write head
    const count = Math.floor(beat);
    const ping = awake * (1 - phase) ** 1.5; // fresh-beat glow, decays
    const snapA = phase < 0.22 ? Math.sin((phase / 0.22) * Math.PI) : 0;
    const wide = smoothstep(1.15, 1.75, box.w / box.h);
    const mix = (a: number, b: number) => lerp(a, b, wide);

    // ── the claw ──────────────────────────────────────────────────────────
    const c = L(mix(SQUARE.claw[2], WIDE.claw[2]));
    const px = X(mix(SQUARE.claw[0], WIDE.claw[0]));
    const py = Y(mix(SQUARE.claw[1], WIDE.claw[1]));
    const rot = 0.3 + 0.025 * Math.sin(t * 0.7);
    const bite = -0.12 + 0.22 * snapA * awake;
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.scale(c, c);
    // two half-density coats: they add up to a solid shell everywhere but
    // the shine, which only gets the first coat
    g.beginPath();
    clawPath(g, bite);
    g.fillStyle = INK(0.5);
    g.fill('nonzero');
    g.save();
    g.beginPath();
    g.rect(-4, -4, 8, 8);
    shine(g);
    g.clip('evenodd');
    g.beginPath();
    clawPath(g, bite);
    g.fill('nonzero');
    g.restore();
    g.restore();

    // ── channels: chat bubbles around the claw ────────────────────────────
    const bw = Math.max(12, L(0.46));
    const bh = Math.max(7, L(0.27));
    const lit = count % AT.length;
    for (let k = 0; k < AT.length; k++) {
      const at = AT[k];
      const s = at < 0 ? 1 : easeOutBack(range(at, at + 0.08, p));
      if (s <= 0.05) continue;
      const bu = mix(SQUARE.bubbles[k][0], WIDE.bubbles[k][0]);
      const bv = mix(SQUARE.bubbles[k][1], WIDE.bubbles[k][1]);
      const w = Math.round(bw * s);
      const h = Math.round(bh * s);
      // kept inside a 6% margin whatever the box's shape
      const x0 = Math.round(clamp(X(bu) - w / 2, box.x + box.w * 0.06, box.x + box.w * 0.94 - w)) + 0.5;
      const y0 = Math.round(clamp(Y(bv) - h / 2, box.y + box.h * 0.06, box.y + box.h * 0.94 - h)) + 0.5;
      const hot = k === lit ? ping : 0;
      // a channel arriving flashes accent until it settles (no density dip)
      const fresh = at < 0 ? 0 : 1 - range(at + 0.06, at + 0.12, p);
      const inkK = clamp(2 - 2 * fresh);
      const accK = clamp(2 * fresh);
      strokeRound(g, x0, y0, w, h, rad, lw, INK(inkK));
      if (accK > 0) strokeRound(g, x0, y0, w, h, rad, lw, ACC(accK));
      // tail toward the claw
      const dir = clamp((px - (x0 + w / 2)) / (w * 0.8), -1, 1);
      const tx = x0 + w * (0.5 + 0.28 * dir);
      const tw = Math.max(2, h * 0.28);
      g.beginPath();
      g.moveTo(tx - tw / 2, y0 + h - 0.5);
      g.lineTo(tx + tw / 2, y0 + h - 0.5);
      g.lineTo(tx + dir * tw * 0.9, y0 + h + tw * 1.1);
      g.closePath();
      g.fillStyle = INK(inkK);
      g.fill();
      if (accK > 0) {
        g.fillStyle = ACC(accK);
        g.fill();
      }
      // app badge + message rows; the beat's channel gets a fresh message
      const bs = Math.max(3, Math.round(h * 0.38));
      const bx = x0 + 2 + bs / 2;
      const by = y0 + h / 2;
      badge(g, bx, by, bs * s, k, INK(clamp(2 - 3 * hot)));
      if (hot > 0.02) badge(g, bx, by, bs * s, k, ACC(clamp(3 * hot)));
      const rows = h >= 9 ? 2 : 1;
      const ry = Math.round(by - (rows * 3 - 1) / 2);
      const rx = x0 + bs + 4;
      const rw = w - bs - 6;
      textLines(g, rx, ry, rw, rows, 2, 1, INK(0.5 * clamp(1 - 2 * hot)), 5 + k);
      if (hot > 0.02) textLines(g, rx, ry, rw, rows, 2, 1, ACC(clamp(1.6 * hot)), 5 + k);
    }

    // ── heartbeat: a monitor trace written by a head on the right ─────────
    // The paper scrolls left; the head writes the signal as it arrives, so a
    // new spike grows out of the head instead of popping in.
    const xa = box.x + box.w * 0.07;
    const xb = box.x + box.w * 0.93;
    const y0 = snap(Y(0.82));
    const amp = L(0.2) * lerp(0.45, 1, awake);
    const sw = Math.max(3.5, L(0.1)); // spike width
    const D = Math.min((xb - xa) * 0.42, L(1)); // distance between beats
    const kMax = Math.ceil((xb - xa) / D) + 2;
    /** Build the trace path, clipped to [xa, xb]; returns the head's height. */
    const trace = () => {
      g.beginPath();
      let pX = -Infinity;
      let pY = y0;
      let on = false;
      for (let k = kMax; k >= -1; k--) {
        const xk = xb - (phase + k) * D; // this beat's R-peak
        for (const [bx, by] of BEAT) {
          const x = xk + bx * sw;
          const y = y0 + by * amp;
          if (!on && x >= xa) {
            g.moveTo(xa, pX === -Infinity ? y0 : pY + ((y - pY) * (xa - pX)) / (x - pX));
            on = true;
          }
          if (x > xb) {
            const yh = pY + ((y - pY) * (xb - pX)) / (x - pX);
            g.lineTo(xb, yh);
            return yh;
          }
          if (on) g.lineTo(x, y);
          pX = x;
          pY = y;
        }
      }
      return y0;
    };
    const grad = g.createLinearGradient(xa, 0, xb, 0);
    grad.addColorStop(0, INK(0.22));
    grad.addColorStop(0.55, INK(0.6));
    grad.addColorStop(1, INK(0.95));
    g.lineWidth = lw;
    g.strokeStyle = grad;
    // the newest beat swaps ink for accent while it's fresh (two clipped
    // passes over the same path, so the swap has no density dip)
    const xn = xb - phase * D;
    const band0 = xn - 1.75 * sw;
    const band1 = Math.min(xb + lw, xn + 1.65 * sw);
    const q = clamp(2 * ping);
    g.save();
    g.beginPath();
    g.rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    g.rect(band0, box.y - 2, band1 - band0, box.h + 4);
    g.clip('evenodd');
    const headY = trace();
    g.stroke();
    g.restore();
    g.save();
    g.beginPath();
    g.rect(band0, box.y - 2, band1 - band0, box.h + 4);
    g.clip();
    trace();
    g.globalAlpha = clamp(2 - 2 * q);
    g.stroke();
    g.globalAlpha = 1;
    if (q > 0) {
      g.strokeStyle = ACC(clamp(2 * q));
      g.stroke();
    }
    g.restore();
    // the write head rides the signal
    const headA = clamp(2 * awake);
    fillCircle(g, xb, headY, lw * 1.3, INK(clamp(2 - 2 * awake)));
    if (headA > 0) fillCircle(g, xb, headY, lw * 1.3, ACC(headA));

    r.commit();
  },
};

export default scene;
