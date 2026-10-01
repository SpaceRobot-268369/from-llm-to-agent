/**
 * agent — an agent is a while-loop. A thick pixel ring (the loop) with three
 * nodes: think (an ellipsis), act (a gear) and observe (an eye). A bright
 * runner with a fading tail laps it continuously (time and scroll both drive
 * it) and lights each node it passes through. Inside the ring the message list
 * grows as you scroll — messages.append(), one typed line at a time, in the
 * same tag + text rows as the tools scene.
 */
import { clamp, easeOut, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, fillCircle, fillRound, strokeArc } from './helpers';

// ── shared "hands & loops" vocabulary (same numbers in tools / agent / subagents)
/** Height of a token / text pill, in design units (min 2 cells). */
const PILL = 0.085;
/** Thickness of a loop ring, in design units. */
const RING = 0.15;

const TAU = Math.PI * 2;

/** Cells per design unit for the largest centred dw × dh design inside `box`, with a margin. */
function fitScale(box: Box, dw: number, dh: number, margin = 0.07) {
  return Math.min((box.w * (1 - 2 * margin)) / dw, (box.h * (1 - 2 * margin)) / dh);
}

/**
 * A loop track: a thick halftone band with solid rims (rims only when the
 * band is wide enough to hold them), drawn as arcs that skip `gaps` (angles,
 * each ±gapHalf) so nodes can sit on it.
 */
function track(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  T: number,
  gaps: number[],
  gapHalf: number,
) {
  const rim = T >= 4.5 ? 1.25 : 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const a0 = sorted[i] + gapHalf;
    const a1 = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TAU) - gapHalf;
    g.lineCap = 'butt';
    strokeArc(g, cx, cy, R, T, INK(rim ? 0.45 : 0.6), a0, a1);
    if (rim) {
      strokeArc(g, cx, cy, R + T / 2 - rim / 2, rim, INK(1), a0, a1);
      strokeArc(g, cx, cy, R - T / 2 + rim / 2, rim, INK(1), a0, a1);
    }
    g.lineCap = 'round';
  }
}

/**
 * The runner: a bright head with a tail that fades behind it (clockwise).
 * Without rims it is drawn a little wider than the band so it covers it fully.
 */
function runner(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, T: number, a: number, tail: number) {
  const n = 14;
  const seg = tail / n;
  const w = T >= 4.5 ? T * 0.95 : T + 0.8;
  g.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const f = i / n;
    strokeArc(g, cx, cy, R, w * (1 - 0.35 * f), ACC(1 - 0.48 * f), a - seg * (i + 1), a - seg * i + 0.004);
  }
  g.lineCap = 'round';
  fillCircle(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, T * 0.62, ACC(1));
}

/**
 * A loop node: a solid disc with its step cut out of it (even-odd), so it
 * reads at a dozen cells. think = an ellipsis, act = a gear, observe = an eye.
 * With `plain`, just the disc (too small for a cut-out).
 */
function node(g: CanvasRenderingContext2D, kind: number, x: number, y: number, rn: number, plain: boolean, style: string) {
  g.beginPath();
  if (plain) {
    g.arc(x, y, rn, 0, TAU);
  } else if (kind === 0) {
    g.arc(x, y, rn, 0, TAU);
    const d = Math.max(2, Math.round(rn * 0.32));
    const sx = Math.round(rn * 0.52);
    for (let i = -1; i <= 1; i++) {
      const qx = Math.round(x + i * sx - d / 2);
      const qy = Math.round(y - d / 2);
      g.moveTo(qx, qy);
      g.lineTo(qx, qy + d);
      g.lineTo(qx + d, qy + d);
      g.lineTo(qx + d, qy);
      g.closePath();
    }
  } else if (kind === 1) {
    const ro = rn * 1.06;
    const ri = rn * 0.76;
    const teeth = 7;
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * TAU - Math.PI / 2;
      g.arc(x, y, i % 2 ? ri : ro, a0, a0 + TAU / (teeth * 2));
    }
    g.closePath();
    g.moveTo(x + rn * 0.36, y);
    g.arc(x, y, rn * 0.36, 0, TAU, true);
  } else {
    g.arc(x, y, rn, 0, TAU);
    const w = rn * 0.78;
    const h = rn * 0.5;
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x, y - h * 2, x + w, y);
    g.quadraticCurveTo(x, y + h * 2, x - w, y);
    g.closePath();
    g.moveTo(x + rn * 0.24, y);
    g.arc(x, y, rn * 0.24, 0, TAU);
  }
  g.fillStyle = style;
  g.fill('evenodd');
}

/** Message rows inside the loop: [tag width, text width] in units. */
const ROWS: [number, number][] = [
  [0.1, 0.42], // system prompt
  [0.1, 0.3], // user goal
  [0.16, 0.26], // tool call
  [0.1, 0.36], // tool result
  [0.16, 0.2], // tool call
  [0.1, 0.4], // tool result
];

/** Node angles (clockwise from the top): think → act → observe. */
const NODES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    // fit the art's real extent: the think node on top (R + rn), the band at
    // the bottom (R + T / 2), the act / observe nodes at the sides. Nodes never
    // drop below 5 cells (their cut-outs need it), so small boxes shrink a bit.
    let k = fitScale(box, 1.62, 1.68);
    if (0.2 * k < 5) k = Math.min(k, (box.h * 0.86 - 5 - Math.max(1.3, 0.075 * k)) / 1.4);
    const L = (l: number) => l * k;
    const R = L(0.7);
    const T = Math.max(2.6, L(RING));
    const rn = Math.max(5, L(0.2));
    const cx = box.cx;
    const cy = box.cy + (rn - T / 2) / 2;
    const pill = Math.max(2, Math.round(L(PILL)));
    const rowGap = Math.max(1, Math.round(L(0.06)));

    // runner: laps with time, and scrolling advances it too
    const a = NODES[0] + (t / 3.2) * TAU + p * TAU * 2.5;

    // ── the ring
    const half = (rn + 0.8) / R;
    track(g, cx, cy, R, T, NODES, half);

    // ── runner + fading tail, clipped out of the nodes (it ducks into each one)
    g.save();
    g.beginPath();
    g.rect(0, 0, r.w, r.h);
    for (const na of NODES) {
      const nx = cx + Math.cos(na) * R;
      const ny = cy + Math.sin(na) * R;
      g.moveTo(nx + rn + 0.5, ny);
      g.arc(nx, ny, rn + 0.5, 0, TAU);
    }
    g.clip('evenodd');
    runner(g, cx, cy, R, T, a, 1.25);
    g.restore();

    // ── nodes: think → act → observe; the one the runner is in lights up
    const plain = rn < 5;
    for (let i = 0; i < NODES.length; i++) {
      const na = NODES[i];
      let d = (((a - na) % TAU) + TAU) % TAU;
      if (d > Math.PI) d -= TAU;
      const lit = d > -half && d < half + 0.45;
      node(g, i, cx + Math.cos(na) * R, cy + Math.sin(na) * R, rn, plain, lit ? ACC(1) : INK(1));
    }

    // ── the message list, growing one line per lap
    const grow = 3 + (ROWS.length - 3) * range(0.05, 0.72, p);
    const count = Math.min(ROWS.length, Math.ceil(grow - 1e-6));
    const step = pill + rowGap;
    const stackH = ROWS.length * step - rowGap;
    // centred, but always clear of the think node at the top of the ring
    const y0 = Math.round(Math.max(cy - stackH / 2 - L(0.01), cy - R + rn + Math.max(1.5, L(0.06))));
    const x0 = Math.round(cx - L(0.29));
    const tagGap = Math.max(1, Math.round(L(0.04)));
    for (let i = 0; i < count; i++) {
      const [tw, xw] = ROWS[i];
      const f = i < count - 1 ? 1 : easeOut(clamp(grow - i));
      const y = y0 + i * step;
      const tag = Math.round(L(tw));
      const full = tag + tagGap + Math.round(L(xw));
      const lim = Math.round(full * f);
      fillRound(g, x0, y, Math.min(tag, lim), pill, pill / 2, INK(1));
      if (lim > tag + tagGap) fillRound(g, x0 + tag + tagGap, y, lim - tag - tagGap, pill, pill / 2, INK(0.6));
    }

    r.commit();
  },
};

export default scene;
