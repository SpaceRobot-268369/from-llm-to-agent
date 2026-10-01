/**
 * subagents — a sub-agent is just another tool. The agent loop from the agent
 * scene (thick ring, think · act · observe nodes, a runner, its message list)
 * sits on the left; three small rings hang off its act node on dotted tethers.
 * Scrolling spawns them one by one: each gets a task, draws itself, and runs
 * its own fast accent runner while its own context fills up. Meanwhile the
 * parent pauses: its runner fades and a dotted pending-call ring turns around
 * its act node. Then each child sends back one short report that lands as a
 * single line in the parent's list, and goes quiet — from the parent's side,
 * the whole agent was one tool call.
 */
import { easeInOut, easeOut, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, fillCircle, fillRound, strokeArc } from './helpers';

// ── shared "hands & loops" vocabulary (same numbers in tools / agent / subagents)
/** Height of a token / text pill, in design units (min 2 cells). */
const PILL = 0.085;
/** Thickness of a loop ring, in design units. */
const RING = 0.15;
/** Dotted connector: dot size and spacing, in design units. */
const DOT = 0.06;
const DOT_GAP = 0.12;

const TAU = Math.PI * 2;

/** Largest centred design space of dw × dh units inside `box`, with a margin. */
function fit(box: Box, dw: number, dh: number, margin = 0.07) {
  const k = Math.min((box.w * (1 - 2 * margin)) / dw, (box.h * (1 - 2 * margin)) / dh);
  return {
    k,
    X: (u: number) => box.cx + u * k,
    Y: (v: number) => box.cy + v * k,
    L: (l: number) => l * k,
  };
}

/** A loop track (halftone band, solid rims when wide enough), skipping node gaps. */
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
  g.lineCap = 'butt';
  for (let i = 0; i < sorted.length; i++) {
    const a0 = sorted[i] + gapHalf;
    const a1 = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TAU) - gapHalf;
    strokeArc(g, cx, cy, R, T, INK(rim ? 0.45 : 0.6), a0, a1);
    if (rim) {
      strokeArc(g, cx, cy, R + T / 2 - rim / 2, rim, INK(1), a0, a1);
      strokeArc(g, cx, cy, R - T / 2 + rim / 2, rim, INK(1), a0, a1);
    }
  }
  g.lineCap = 'round';
}

/**
 * A runner: a bright head with a tail that fades behind it (clockwise).
 * Without rims it is drawn a little wider than the band so it covers it fully.
 */
function runner(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  T: number,
  a: number,
  tail: number,
  style: (alpha: number) => string,
) {
  const n = 12;
  const seg = tail / n;
  const w = T >= 4.5 ? T * 0.95 : T + 0.8;
  g.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const f = i / n;
    strokeArc(g, cx, cy, R, w * (1 - 0.35 * f), style(1 - 0.48 * f), a - seg * (i + 1), a - seg * i + 0.004);
  }
  g.lineCap = 'round';
  fillCircle(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, T * 0.62, style(1));
}

/** A loop node: a disc with its step cut out (ellipsis / gear / eye), or plain. */
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

/** Point on a quadratic Bézier. */
function qpt(x0: number, y0: number, qx: number, qy: number, x1: number, y1: number, s: number): [number, number] {
  const m = 1 - s;
  return [m * m * x0 + 2 * m * s * qx + s * s * x1, m * m * y0 + 2 * m * s * qy + s * s * y1];
}

/** Parent node angles (clockwise from the top): think → act → observe. */
const NODES = [-Math.PI / 2, 0, Math.PI / 2];
/** Children: centre (design units) and phase offset of their runners. */
const KIDS: [number, number, number][] = [
  [0.6, -0.6, 0.4],
  [0.78, 0, 2.1],
  [0.6, 0.6, 4.3],
];
/** Parent message list: system prompt and the big task, then one short line per child report. */
const ROWS: [number, number][] = [
  [0.1, 0.34],
  [0.1, 0.26],
  [0.1, 0.12],
  [0.1, 0.16],
  [0.1, 0.1],
];
const FIRST_REPORT = 2;

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { X, Y, L } = fit(box, 2.1, 1.75);
    const pill = Math.max(2, Math.round(L(PILL * 0.8)));
    const dot = Math.max(2, Math.round(L(DOT)));
    const gap = Math.max(4, Math.round(L(DOT_GAP)));

    // ── parent loop
    const pcx = X(-0.45);
    const pcy = Y(0);
    const R = L(0.52);
    const T = Math.max(2.6, L(RING));
    // big enough for the think / act / observe cut-outs whenever the ring allows it
    const rn = R >= 13 ? Math.max(5, L(0.165)) : Math.max(3.2, L(0.165));
    const half = (rn + 0.8) / R;
    // the parent pauses on its act node while the children work: its runner
    // fades out (a fade, not a glide — any glide into the node would jump as
    // the time-driven runner wraps) and a pending-call ring turns around act
    const wait = easeInOut(range(0.03, 0.1, p)) * (1 - easeInOut(range(0.76, 0.84, p)));
    const pa = NODES[0] + (t / 3.2) * TAU + p * TAU * 1.5;
    const live = 1 - wait;

    track(g, pcx, pcy, R, T, NODES, half);
    g.save();
    g.beginPath();
    g.rect(0, 0, r.w, r.h);
    for (const na of NODES) {
      const nx = pcx + Math.cos(na) * R;
      const ny = pcy + Math.sin(na) * R;
      g.moveTo(nx + rn + 0.5, ny);
      g.arc(nx, ny, rn + 0.5, 0, TAU);
    }
    g.clip('evenodd');
    if (live > 0.02) runner(g, pcx, pcy, R, T, pa, 1.1 * (0.4 + 0.6 * live), (al) => INK(al * live));
    g.restore();
    const plain = rn < 5;
    for (let i = 0; i < NODES.length; i++) {
      node(g, i, pcx + Math.cos(NODES[i]) * R, pcy + Math.sin(NODES[i]) * R, rn, plain, INK(1));
    }
    // while it waits, a dotted ring turns around the act node (a pending call)
    if (wait > 0) {
      g.beginPath();
      g.arc(pcx + R, pcy, rn + dot / 2 + Math.max(1, L(0.04)), 0, TAU);
      g.lineWidth = dot;
      g.strokeStyle = INK(0.75 * wait);
      g.lineCap = 'butt';
      g.setLineDash([dot, gap - dot]);
      g.lineDashOffset = -(t * 4 + p * 30);
      g.stroke();
      g.setLineDash([]);
      g.lineCap = 'round';
    }

    // ── children
    const ax = pcx + R + rn + Math.max(1, L(0.03));
    const ay = pcy;
    const rc = L(0.2);
    const Tc = Math.max(1.8, L(0.07));
    const pw = Math.max(4, Math.round(L(0.16)));
    const landed: number[] = [];
    const flow = Math.floor(t * 6);
    for (let i = 0; i < KIDS.length; i++) {
      const [ku, kv, ph] = KIDS[i];
      const kx = X(ku);
      const ky = Y(kv);
      const s0 = 0.08 + 0.08 * i;
      const spawn = range(s0, s0 + 0.12, p);
      const r0 = 0.46 + 0.08 * i;
      const report = range(r0, r0 + 0.1, p);
      const done = easeOut(range(r0 + 0.06, r0 + 0.14, p));
      // its runner fades in as the ring closes and out as it goes quiet
      const alive = range(0.85, 1, spawn) * (1 - done);

      // tether: from the act node to the child's near side
      const ta = Math.atan2(ay - ky, ax - kx);
      const ex = kx + Math.cos(ta) * (rc + Tc);
      const ey = ky + Math.sin(ta) * (rc + Tc);
      const qx = (ax + ex) / 2;
      const qy = ky;
      const busy = (spawn > 0 && spawn < 1) || (report > 0 && report < 1);
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo(qx, qy, ex, ey);
      g.lineWidth = dot;
      g.strokeStyle = INK(busy ? 0.9 : spawn > 0 && done < 1 ? 0.6 : 0.42);
      g.lineCap = 'butt';
      g.setLineDash([dot, gap - dot]);
      g.lineDashOffset = report > 0 && report < 1 ? flow : -flow;
      g.stroke();
      g.setLineDash([]);
      g.lineCap = 'round';

      // the ring: a ghost before it spawns and after it reports; drawn in as it spawns
      const ghost = INK(0.5);
      const draw = easeInOut(range(0.45, 1, spawn));
      const ringA = spawn > 0 ? 0.62 - 0.32 * done : 0;
      if (draw < 1 || done > 0) strokeArc(g, kx, ky, rc, Math.max(1.6, Tc * 0.7), ghost);
      if (draw > 0 && done < 1) {
        g.lineCap = 'butt';
        strokeArc(g, kx, ky, rc, Tc, INK(ringA), -Math.PI / 2, -Math.PI / 2 + TAU * draw);
        g.lineCap = 'round';
      }
      // the same three nodes, small
      for (let j = 0; j < NODES.length; j++) {
        if (spawn > 0 && done <= 0 && NODES[j] + Math.PI / 2 > TAU * draw + 0.01) continue;
        const nx = kx + Math.cos(NODES[j]) * rc;
        const ny = ky + Math.sin(NODES[j]) * rc;
        fillCircle(g, nx, ny, Tc * 0.95, INK(spawn > 0 && done < 1 ? 1 : 0.55));
      }

      // the task goes out
      if (spawn > 0 && spawn < 0.55) {
        const [px, py] = qpt(ax, ay, qx, qy, ex, ey, easeInOut(spawn / 0.55));
        fillRound(g, px - pw / 2, py - pill / 2, pw, pill, pill / 2, INK(1));
      }

      // its own context fills while it works (only where the ring has room)
      if (spawn > 0.6 && done < 1 && rc - Tc >= 3.5) {
        const work = range(s0 + 0.12, r0, p) * (1 - done);
        const rows = Math.max(2, Math.floor((rc * 1.3) / 2));
        const lh = 1;
        const top = ky - (rows * 2 - 1) / 2;
        const shown = Math.ceil(rows * (0.25 + 0.75 * work));
        for (let j = 0; j < Math.min(rows, shown); j++) {
          const yy = Math.round(top + j * 2);
          const half2 = Math.sqrt(Math.max(0, (rc - Tc) ** 2 - (yy + 0.5 - ky) ** 2)) * 0.8;
          if (half2 < 1) continue;
          fillRound(g, kx - half2, yy, half2 * 2 * (0.6 + 0.4 * ((j * 7 + i) % 3) / 2), lh, 0, INK(0.4));
        }
      }

      // its own runner (the new idea: a whole fresh loop)
      if (alive > 0.02) {
        const ca = ph + (t / 1.3) * TAU + p * TAU * 4;
        runner(g, kx, ky, rc, Tc, ca, 1.6, (al) => ACC(al * alive));
      }

      // one short report comes back
      if (report > 0 && report < 1) {
        const [px, py] = qpt(ex, ey, qx, qy, ax, ay, easeInOut(report));
        fillRound(g, px - pw / 2, py - pill / 2, pw, pill, pill / 2, ACC(1));
      }
      landed.push(easeOut(range(r0 + 0.09, r0 + 0.13, p)));
    }

    // ── parent's message list: system + task, then one line per report.
    // The row gap shrinks to 1 cell if the list would touch the top / bottom
    // nodes; on a ring too small even for that, the system row is left out.
    const room = 2 * (R - rn - 1);
    const fits = (n: number, gapN: number) => n * (pill + gapN) - gapN <= room;
    let rowGap = Math.max(1, Math.round(L(0.05)));
    if (!fits(ROWS.length, rowGap)) rowGap = 1;
    const first = fits(ROWS.length, rowGap) ? 0 : 1;
    const step = pill + rowGap;
    const stackH = (ROWS.length - first) * step - rowGap;
    const y0 = Math.round(pcy - stackH / 2);
    const x0 = Math.round(pcx - L(0.25));
    const tagGap = Math.max(1, Math.round(L(0.04)));
    for (let i = first; i < ROWS.length; i++) {
      const f = i < FIRST_REPORT ? 1 : landed[i - FIRST_REPORT];
      if (f <= 0) continue;
      const [tw, xw] = ROWS[i];
      const y = y0 + (i - first) * step;
      const tag = Math.round(L(tw));
      const lim = Math.round((tag + tagGap + L(xw)) * f);
      fillRound(g, x0, y, Math.min(tag, lim), pill, pill / 2, INK(1));
      if (lim > tag + tagGap) fillRound(g, x0 + tag + tagGap, y, lim - tag - tagGap, pill, pill / 2, INK(i < FIRST_REPORT ? 0.6 : 0.85));
    }

    r.commit();
  },
};

export default scene;
