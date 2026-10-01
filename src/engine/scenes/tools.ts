/**
 * tools — the model can't run code, it can ask. A pair of JSON braces `{ }`
 * (the model's side) and a turning gear (your code), joined by dotted arrows:
 * the request runs straight across to the gear, the result comes back down and
 * around into a new line appended under the braces. Scrolling types the JSON
 * request, sends it as a bright packet into the gear (its hub lights while it
 * runs), then carries the result back as an ink packet that lands as that line.
 */
import { clamp, easeInOut, easeOut, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, blink, fillCircle, fillRound } from './helpers';

// ── shared "hands & loops" vocabulary (same numbers in tools / agent / subagents)
/** Stroke weight of primary outlines, in design units (min 1.6 cells). */
const STROKE = 0.08;
/** Height of a token / text pill, in design units (min 2 cells). */
const PILL = 0.085;
/** Dotted connector: dot size and spacing, in design units. */
const DOT = 0.06;
const DOT_GAP = 0.12;

/** Design width, base height (braces + drop + result row + arrowhead) and stretch, in units. */
const DW = 2.02;
const DH = 1.41;
const STRETCH = 0.4;

type Pt = [number, number];

/** Snap a line centre so a stroke `w` cells wide covers whole cells. */
const snap = (c: number, w: number) => Math.round(c - w / 2) + w / 2;

/**
 * A dotted polyline (square pixel dots) with a solid arrowhead at its last
 * point. `flow` shifts the dots along the path (in cells).
 */
function dottedPath(
  g: CanvasRenderingContext2D,
  pts: Pt[],
  dot: number,
  gap: number,
  head: number,
  flow: number,
  style: string,
) {
  const n = pts.length;
  const [x1, y1] = pts[n - 1];
  const [xp, yp] = pts[n - 2];
  const len = Math.hypot(x1 - xp, y1 - yp) || 1;
  const ux = (x1 - xp) / len;
  const uy = (y1 - yp) / len;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n - 1; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineTo(x1 - ux * head * 0.9, y1 - uy * head * 0.9);
  g.lineWidth = dot;
  g.strokeStyle = style;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.setLineDash([dot, gap - dot]);
  g.lineDashOffset = -flow;
  g.stroke();
  g.setLineDash([]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // arrowhead
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - ux * head - uy * head * 0.62, y1 - uy * head + ux * head * 0.62);
  g.lineTo(x1 - ux * head + uy * head * 0.62, y1 - uy * head - ux * head * 0.62);
  g.closePath();
  g.fillStyle = style;
  g.fill();
}

/** The point at fraction `s` (0..1) of a polyline's length, and whether that leg is vertical. */
function along(pts: Pt[], s: number): [number, number, boolean] {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let d = clamp(s) * total;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const l = Math.hypot(bx - ax, by - ay);
    if (d <= l || i === pts.length - 1) {
      const f = l > 0 ? Math.min(1, d / l) : 0;
      return [ax + (bx - ax) * f, ay + (by - ay) * f, Math.abs(by - ay) > Math.abs(bx - ax)];
    }
    d -= l;
  }
  return [pts[0][0], pts[0][1], false];
}

/** A curly brace from (x0 … x1) × (y0 … y1); `open` = '{', else '}'. */
function brace(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  open: boolean,
  lw: number,
  style: string,
) {
  const tip = open ? x0 : x1;
  const tail = open ? x1 : x0;
  const xm = (x0 + x1) / 2;
  const ym = (y0 + y1) / 2;
  const rr = (x1 - x0) / 2;
  g.beginPath();
  g.moveTo(tail, y0);
  g.quadraticCurveTo(xm, y0, xm, y0 + rr);
  g.lineTo(xm, ym - rr);
  g.quadraticCurveTo(xm, ym, tip, ym);
  g.quadraticCurveTo(xm, ym, xm, ym + rr);
  g.lineTo(xm, y1 - rr);
  g.quadraticCurveTo(xm, y1, tail, y1);
  g.lineWidth = lw;
  g.strokeStyle = style;
  g.stroke();
}

/** A spur gear with a hole, filled (even-odd), rotated by `rot`. */
function gear(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  hole: number,
  teeth: number,
  rot: number,
  style: string,
) {
  const step = (Math.PI * 2) / teeth;
  g.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    const pts: Pt[] = [
      [ri, a - step * 0.5],
      [ri, a - step * 0.3],
      [ro, a - step * 0.2],
      [ro, a + step * 0.2],
      [ri, a + step * 0.3],
    ];
    for (let j = 0; j < pts.length; j++) {
      const [rad, ang] = pts[j];
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0 && j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  }
  g.closePath();
  g.moveTo(cx + hole, cy);
  g.arc(cx, cy, hole, 0, Math.PI * 2, true);
  g.fillStyle = style;
  g.fill('evenodd');
}

/** JSON rows inside the braces: [indent, key width, value width] in units. */
const ROWS: [number, number, number][] = [
  [0, 0.12, 0.19], //  "tool": "get_weather"
  [0, 0.12, 0.05], //  "args": {
  [0.07, 0.11, 0.15], //    "city": "Sydney"
  [0, 0.05, 0], //  }
];

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    // width-limited on most boxes; spare height stretches the layout a little
    const m = 0.07;
    const k = Math.min((box.w * (1 - 2 * m)) / DW, (box.h * (1 - 2 * m)) / DH);
    const L = (l: number) => l * k;
    const extra = clamp((box.h * (1 - 2 * m)) / k - DH, 0, STRETCH);
    const hb = 1 + extra * 0.5; // brace height
    const drop = 0.24 + extra * 0.5; // braces bottom → result row
    // the bottom arrowhead overhangs the result row a little: centre the true extent
    const top = -(hb + drop + PILL) / 2 - 0.015;
    const X = (u: number) => box.cx + (u + 0.015) * k; // art spans u ∈ [-1.02, 0.99]
    const Y = (v: number) => box.cy + v * k;

    const sw = Math.max(1.6, L(STROKE));
    const pill = Math.max(2, Math.round(L(PILL)));
    const dot = Math.max(2, Math.round(L(DOT)));
    const gap = Math.max(4, Math.round(L(DOT_GAP)));
    const head = Math.max(3, L(0.13));
    const flow = Math.floor(t * 6);

    // ── beats
    const typed = 0.38 + 0.62 * easeOut(range(0.04, 0.22, p));
    const appear = range(0.19, 0.24, p);
    const send = easeInOut(range(0.24, 0.38, p));
    const run = range(0.38, 0.52, p);
    const back = easeInOut(range(0.5, 0.65, p));
    const land = easeOut(range(0.64, 0.72, p));

    // ── braces + JSON request (the model's side)
    const bx0 = Math.round(X(-0.98));
    const bx1 = Math.round(X(-0.26));
    const by0 = Math.round(Y(top));
    const by1 = Math.round(Y(top + hb));
    const bw = L(0.12);
    brace(g, bx0, by0, bx0 + bw, by1, true, sw, INK(1));
    brace(g, bx1 - bw, by0, bx1, by1, false, sw, INK(1));

    const cx0 = Math.round(bx0 + bw / 2 + L(0.12));
    const rowStep = pill + Math.max(1, Math.round(L(0.07 + extra * 0.12)));
    const rowsH = ROWS.length * rowStep - (rowStep - pill);
    const ry0 = Math.round((by0 + by1) / 2 - rowsH / 2);
    const shown = typed * ROWS.length;
    const kGap = Math.max(1, Math.round(L(0.045)));
    let cursorX = cx0;
    let cursorY = ry0;
    for (let i = 0; i < ROWS.length; i++) {
      const f = Math.min(1, shown - i);
      if (f <= 0) break;
      const [ind, kw, vw] = ROWS[i];
      const y = ry0 + i * rowStep;
      const x = cx0 + Math.round(L(ind));
      const kL = Math.round(L(kw));
      const vL = Math.round(L(vw));
      const lim = Math.round((kL + (vw > 0 ? kGap + vL : 0)) * f);
      // key pill (solid) and value pill (dotted): reads as "key": value
      fillRound(g, x, y, Math.min(kL, lim), pill, pill / 2, INK(1));
      if (vw > 0 && lim > kL + kGap) fillRound(g, x + kL + kGap, y, lim - kL - kGap, pill, pill / 2, INK(0.6));
      cursorX = x + lim + kGap;
      cursorY = y;
    }
    if (typed < 1) fillRound(g, cursorX, cursorY - 1, Math.max(1.5, pill * 0.6), pill + 2, 0, INK(blink(t) ? 1 : 0.2));

    // ── gear (your code), level with the braces
    const gx = X(0.66);
    const gy = (by0 + by1) / 2;
    const ro = L(0.33);
    const spin = t * 0.45 + easeInOut(run) * Math.PI * 1.5 + p * 1.2;
    const hubR = Math.max(2.2, L(0.12));
    gear(g, gx, gy, ro, ro - Math.max(2.4, L(0.1)), hubR, 8, spin, INK(1));

    // ── request →: straight across into the gear
    const ay = snap(gy, dot);
    const req: Pt[] = [
      [Math.round(bx1 + L(0.08)), ay],
      [Math.round(gx - ro - L(0.05)), ay],
    ];
    // brighter while a packet travels, but below 1 so the accent packet wins
    dottedPath(g, req, dot, gap, head, flow, INK(send > 0 && send < 1 ? 0.85 : 0.6));

    // ── ← result: down out of the gear, back along the bottom, into a new line
    const ly = Math.round(Y(top + hb + drop));
    const gxr = snap(gx, dot);
    const lyc = snap(ly + pill / 2, dot);
    const res: Pt[] = [
      [gxr, Math.round(gy + ro + L(0.06))],
      [gxr, lyc],
      [Math.round(bx1 + L(0.05)), lyc],
    ];
    dottedPath(g, res, dot, gap, head, flow, INK(back > 0 && back < 1 ? 0.85 : 0.6));

    // ── packets ride centred on the path: the request (accent) and the result (ink)
    const pw = Math.max(4, Math.round(L(0.17)));
    const reqLen = req[1][0] - req[0][0];
    if (appear > 0 && send < 1) {
      const lo = pw / 2 / reqLen;
      const [px, py] = along(req, lo + (1 - 2 * lo) * send);
      fillRound(g, Math.round(px - pw / 2), Math.round(py - pill / 2), pw, pill, pill / 2, ACC(appear));
    }
    // while it runs, the request sits in the gear's hub
    if (send >= 1 && back <= 0) fillCircle(g, gx, gy, hubR * (0.85 + 0.15 * blink(t)), ACC(1));
    if (back > 0 && back < 1) {
      const [px, py, vert] = along(res, back);
      if (vert) fillRound(g, Math.round(px - pill / 2), Math.round(py - pw / 2), pill, pw, pill / 2, INK(1));
      else fillRound(g, Math.round(px - pw / 2), Math.round(py - pill / 2), pw, pill, pill / 2, INK(1));
    }

    // ── the tool_result line, appended under the request
    if (land > 0) {
      const tag = Math.round(L(0.13));
      const lw = Math.round((bx1 - bx0 - tag) * land);
      fillRound(g, bx0, ly, tag, pill, pill / 2, INK(1));
      fillRound(g, bx0 + tag + kGap, ly, Math.max(0, lw - kGap), pill, pill / 2, INK(0.6));
    }

    r.commit();
  },
};

export default scene;
