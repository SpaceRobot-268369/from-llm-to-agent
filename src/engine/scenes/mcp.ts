/**
 * mcp — one plug for every tool. Three apps (outlined windows, left) and four
 * tools (solid blocks, right) start as an N×M tangle of twelve crossing
 * wires. Scrolling plugs one socket into the middle and pulls every wire
 * through it: the tangle straightens and collapses onto seven clean wires
 * (N+M), and calls start flowing through the socket.
 */
import { clamp, easeInOut, hash2, lerp, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, fillCircle, fillRound, line, space, strokeRound, textLines } from './helpers';

const N = 3;
const M = 4;
const APP_V = [-0.56, 0, 0.56];
const TOOL_V = [-0.63, -0.21, 0.21, 0.63];

/** Where each of the N×M tangled wires crosses the middle, and at what angle. */
const TANGLE = Array.from({ length: N * M }, (_, k) => ({
  du: (hash2(k, 1, 17) - 0.5) * 0.7,
  dv: (hash2(k, 2, 17) - 0.5) * 1.2,
  th: (hash2(k, 3, 17) - 0.5) * 2.6,
  ph: hash2(k, 4, 17) * Math.PI * 2,
}));

const easeOutBack = (x: number) => (x <= 0 ? 0 : 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2);
const frac = (x: number) => x - Math.floor(x);

type G = CanvasRenderingContext2D;

/**
 * A cubic wire from (x0, y0) leaving along (ax, ay) to (x1, y1) arriving along
 * (bx, by); h0 / h1 are the handle lengths at each end.
 */
function wire(g: G, x0: number, y0: number, ax: number, ay: number, x1: number, y1: number, bx: number, by: number, h0: number, h1: number, lw: number, style: string) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.bezierCurveTo(x0 + ax * h0, y0 + ay * h0, x1 - bx * h1, y1 - by * h1, x1, y1);
  g.lineWidth = lw;
  g.strokeStyle = style;
  g.stroke();
}

/** Point on a horizontal-tangent S-curve from (x0, y0) to (x1, y1) at s ∈ [0, 1]. */
function sCurve(x0: number, y0: number, x1: number, y1: number, s: number): [number, number] {
  const h = (x1 - x0) * 0.5;
  const u = 1 - s;
  const b0 = u * u * u;
  const b1 = 3 * u * u * s;
  const b2 = 3 * u * s * s;
  const b3 = s * s * s;
  return [b0 * x0 + b1 * (x0 + h) + b2 * (x1 - h) + b3 * x1, (b0 + b1) * y0 + (b2 + b3) * y1];
}

/**
 * Tool glyphs as 5×5 pixel bitmaps (dot, bars, plus, play), punched out of the
 * tool blocks. Bitmaps on whole cells stay crisp where vector glyphs blurred.
 */
const GLYPHS = [
  ['.###.', '#####', '#####', '#####', '.###.'],
  ['.....', '#####', '.....', '#####', '.....'],
  ['..#..', '..#..', '#####', '..#..', '..#..'],
  ['##...', '####.', '#####', '####.', '##...'],
];

/** A tool: solid rounded block on whole cells with a glyph punched out of it. */
function tool(g: G, x0: number, y0: number, s: number, rad: number, kind: number, style: string) {
  g.beginPath();
  g.roundRect(x0, y0, s, s, rad);
  const o = Math.floor((s - 5) / 2);
  const rows = GLYPHS[kind % GLYPHS.length];
  for (let y = 0; y < 5; y++) {
    const row = rows[y];
    let x = 0;
    while (x < 5) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let e = x;
      while (e < 5 && row[e] === '#') e++;
      g.rect(x0 + o + x, y0 + o + y, e - x, 1);
      x = e;
    }
  }
  g.fillStyle = style;
  g.fill('evenodd');
}

/**
 * Family card: an outlined window with a solid title bar and ragged text
 * rows. Snapped so the outline sits on cell centres and reads crisp.
 */
function card(g: G, cx: number, cy: number, w: number, h: number, rad: number, lw: number, rows: number, seed: number, style: string, rowStyle: string) {
  const x0 = Math.round(cx - w / 2) + 0.5;
  const y0 = Math.round(cy - h / 2) + 0.5;
  const ww = Math.round(w) - 1;
  const hh = Math.round(h) - 1;
  const bar = Math.max(2, Math.round(hh * 0.28));
  strokeRound(g, x0, y0, ww, hh, rad, lw, style);
  fillRound(g, x0, y0, ww, bar, rad, style);
  const rowH = 2;
  const gap = 1;
  const room = Math.floor((hh - bar - 2 + gap) / (rowH + gap));
  const n = Math.max(0, Math.min(rows, room));
  textLines(g, x0 + 2, y0 + bar + 1.5, ww - 4, n, rowH, gap, rowStyle, seed);
}

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { Y, L } = space(box);
    const hw = box.w / 2;
    const snap = (y: number) => Math.floor(y) + 0.5;
    // family vocabulary: one primary stroke, one card radius
    const lw = Math.max(1.5, L(0.045));
    const rad = L(0.06);

    const plug = easeOutBack(range(0.05, 0.28, p)); // socket pops in
    const route = easeInOut(range(0.12, 0.55, p)); // wires pulled through it
    const flow = range(0.5, 0.65, p); // calls start flowing

    const aw = L(0.34);
    const ah = L(0.27);
    const ax = box.cx - hw * 0.72;
    const ts = Math.max(7, 2 * Math.round((L(0.25) - 1) / 2) + 1); // odd, so glyphs centre
    const tx = box.cx + hw * 0.72;
    const tx0 = Math.round(tx - ts / 2);
    const portA = Math.round(ax + aw / 2) - 0.5;
    const portT = tx0 + 0.5;
    // the socket: odd whole-cell size so its slots land on cell edges
    const sz0 = 2 * Math.round(Math.max(9, L(0.34)) / 2) + 1;
    const sz = sz0 * plug;
    const cx = snap(box.cx);
    const cy = snap(box.cy);
    const sl = cx - sz / 2;
    const sr = cx + sz / 2;
    const appY = APP_V.map((v) => snap(Y(v)));
    const toolY = TOOL_V.map((v) => snap(Y(v)));

    // wires never draw over the socket: they run into it
    const clip = sz > 1;
    if (clip) {
      g.save();
      g.beginPath();
      g.rect(box.x - box.w, box.y - box.h, box.w * 3, box.h * 3);
      g.roundRect(cx - sz / 2, cy - sz / 2, sz, sz, sz * 0.26);
      g.clip('evenodd');
    }

    // wires: each is two halves meeting at a midpoint; the midpoints slide
    // into the socket, so the 12 left/right halves pile onto 3 + 4 routes.
    const wob = L(0.035) * (1 - route);
    for (let i = 0; i < N; i++) {
      const ay = appY[i];
      for (let j = 0; j < M; j++) {
        const tw = TANGLE[i * M + j];
        const ty = toolY[j];
        const mx = cx + L(tw.du) + wob * Math.sin(t * 0.9 + tw.ph);
        const my = clamp((ay + ty) / 2 + L(tw.dv), Y(-0.78), Y(0.78)) + wob * Math.cos(t * 0.7 + tw.ph);
        const th = tw.th * (1 - route);
        const dx = Math.cos(th);
        const dy = Math.sin(th);
        const lx = lerp(mx, sl, route);
        const rx = lerp(mx, sr, route);
        const yy = lerp(my, cy, route);
        const w = lerp(1.3, lw, route);
        // coincident halves add up (lighter blend) → a solid route at the end
        const aL = lerp(0.5, 0.98 / M, route);
        const aR = lerp(0.5, 0.98 / N, route);
        // the tangled ends' handles stay short so long wires can't balloon
        // out of the box; they reach full length as the routes straighten
        const hL = (lx - portA) * 0.5;
        const hR = (portT - rx) * 0.5;
        wire(g, portA, ay, 1, 0, lx, yy, dx, dy, hL, lerp(Math.min(hL, L(0.3)), hL, route), w, INK(aL));
        wire(g, rx, yy, dx, dy, portT, ty, 1, 0, lerp(Math.min(hR, L(0.3)), hR, route), hR, w, INK(aR));
        if (route > 0 && route < 1) line(g, lx, yy, rx, yy, w, INK(0.4 * (1 - route)));
      }
    }
    if (clip) g.restore();

    // apps: outlined windows (clients)
    for (let i = 0; i < N; i++) {
      card(g, ax, appY[i], aw, ah, rad, lw, 2, 11 + i, INK(1), INK(0.5));
      fillCircle(g, portA, appY[i], lw, INK(1));
    }

    // tools: solid blocks with punched glyphs (servers)
    for (let j = 0; j < M; j++) {
      tool(g, tx0, Math.round(toolY[j] - ts / 2), ts, Math.min(rad, ts * 0.25), j, INK(1));
      fillCircle(g, portT, toolY[j], lw, INK(1));
    }

    // the socket: one standard plug in the middle
    if (sz > 1) {
      // a slow ring breathing around it once it carries traffic
      const k = frac(t * 0.45);
      const ring = sz * (1.25 + 0.55 * k);
      strokeRound(g, cx - ring / 2, cy - ring / 2, ring, ring, ring * 0.3, Math.max(1.2, L(0.03)), INK(0.45 * (1 - k) * route));
      g.beginPath();
      g.roundRect(cx - sz / 2, cy - sz / 2, sz, sz, sz * 0.26);
      // two slots, mirrored about the centre on whole cells once settled
      const slw = Math.max(2, Math.round(sz * 0.17));
      const slh = Math.round(sz * 0.42);
      const sxL = plug === 1 ? Math.round(cx - sz * 0.22 - slw / 2) : cx - sz * 0.22 - slw / 2;
      const sxR = 2 * cx - sxL - slw;
      const sy = plug === 1 ? Math.round(cy - slh / 2) : cy - slh / 2;
      g.roundRect(sxL, sy, slw, slh, slw / 2);
      g.roundRect(sxR, sy, slw, slh, slw / 2);
      g.fillStyle = ACC(1);
      g.fill('evenodd');
    }

    // calls flowing: small accent packets ride the clean routes
    if (flow > 0) {
      const ps = Math.max(3, Math.round(L(0.08)));
      for (let i = 0; i < N; i++) {
        const s = frac(t * 0.32 + i * 0.37);
        const [x, y] = sCurve(portA, appY[i], sl, cy, s);
        fillRound(g, x - ps / 2, y - ps / 2, ps, ps, ps * 0.25, ACC(flow * Math.min(1, (1 - s) * 6, s * 6)));
      }
      for (let j = 0; j < M; j++) {
        const s = frac(t * 0.32 + j * 0.29 + 0.15);
        const [x, y] = sCurve(sr, cy, portT, toolY[j], s);
        fillRound(g, x - ps / 2, y - ps / 2, ps, ps, ps * 0.25, ACC(flow * Math.min(1, s * 6, (1 - s) * 6)));
      }
    }

    r.commit();
  },
};

export default scene;
