/**
 * mcp — one written spec that every service adopts. An AI APP window sits in
 * the middle; real services float around it as pixel tiles with pixel-font
 * labels (NOTION, DRIVE, ONEDRIVE, SLACK), never joined by any line. Each tile
 * wears a differently shaped port on the side facing the app — square,
 * triangle, round, zigzag: its own language. Copies of those shapes fly at the
 * app, bounce off its edge, and a "?" pops up where they hit: not understood.
 *
 * Scroll (p):
 *   0     – 0.2    the mismatch: four port shapes, packets bouncing off, "?".
 *   0.17  – 0.23   the MCP spec card appears (accent): a document titled MCP
 *                  with two rules, LIST and CALL, and the standard plug shape.
 *   0.235 – 0.46   it stamps each service in turn, then the app: a copy of the
 *                  plug flies over, lands, and the old port crumbles into the
 *                  standard shape (the app's title bar turns accent).
 *   0.46  – 0.55   envelopes (accent) start flying freely both ways between
 *                  the app and every service — on the lanes under the card
 *                  once it has bowed out (0.47 – 0.52).
 *   0.76  – 0.81   a new service (CALENDAR) dissolves in, already wearing the
 *                  plug, a ring marks its arrival, and from 0.8 it joins the
 *                  traffic.
 * t: tiles float by a cell, packets and envelopes travel. p also advances them,
 * so the story still moves with reduced motion (t = 0), and the t = 0 frame
 * shows a packet in flight and one "?". No two lanes cross, and a message
 * never touches a tile, a port or the app.
 *
 * Layout: beside the text (p = 0 only) the services sit above and below the
 * app with ports facing it vertically; in the wide WATCH box they spread left
 * and right with sideways ports (the two port orientations dissolve into each
 * other mid-glide) and the newcomer arrives at top centre. The app moves down
 * when a short box needs room above it for the card and the newcomer's
 * messages. Phones: smaller tiles, no labels, three services (NOTION, DRIVE,
 * ONEDRIVE) in three corners — the newcomer takes the empty fourth.
 */
import { clamp, easeInOut, easeOut, hash2, lerp, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, blink, pixelText, pixelTextWidth } from './helpers';

type G = CanvasRenderingContext2D;
type Bits = readonly string[];
type Pt = [number, number];
type Keep = (r: number, c: number) => boolean;
/** Which way a port's tip points (and which side of its tile it sits on). */
type Dir = 'u' | 'd' | 'l' | 'r';
/** Where messages meet the app: its left / right / top / bottom edge. */
type Side = 'l' | 'r' | 't' | 'b';

const VEC: Record<Dir | Side, Pt> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };

// ── glyphs punched out of the service tiles ('#' = hole) ────────────────
const NOTION: Bits = ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##'];
const DRIVE: Bits = ['...#...', '..###..', '..###..', '.#####.', '.#####.', '#######'];
const CLOUD: Bits = ['....##.', '.##.###', '#######', '#######'];
const SLACK: Bits = ['..#.#..', '..#.#..', '#######', '..#.#..', '#######', '..#.#..', '..#.#..'];
const CALENDAR: Bits = ['.#...#.', '.......', '#######', '#.#.#.#', '#######', '#.#.#.#', '#######'];

// ── ports, written tip-first (row 0 = the end facing the app) ───────────
const SQUARE = 0;
const TRI = 1;
const ROUND = 2;
const ZIG = 3;
const PLUG = 4;
const PORTS_BIG: Bits[] = [
  ['.#####.', '.#####.', '.#####.', '.#####.'],
  ['...#...', '..###..', '.#####.', '#######'],
  ['..###..', '.#####.', '.#####.', '..###..'],
  ['..##...', '...##..', '..##...', '...##..'],
  ['.#...#.', '.#...#.', '#######', '.#####.'],
];
const PORTS_SMALL: Bits[] = [
  ['.###.', '.###.', '.###.'],
  ['..#..', '.###.', '#####'],
  ['.###.', '#####', '.###.'],
  ['.##..', '..##.', '.##..'],
  ['#...#', '#####', '.###.'],
];

/** A message: a small envelope (its flap a solid V). */
const ENV_BIG: Bits = ['#######', '##...##', '#.#.#.#', '#..#..#', '#######'];
const ENV_SMALL: Bits = ['#####', '##.##', '#.#.#', '#####'];
/** "?" (the pixel font's): the app doesn't understand. */
const HUH: Bits = ['##.', '..#', '.#.', '...', '.#.'];

type Svc = { label: string; glyph: Bits; port: number };
const SERVICES: Svc[] = [
  { label: 'NOTION', glyph: NOTION, port: SQUARE },
  { label: 'DRIVE', glyph: DRIVE, port: TRI },
  { label: 'ONEDRIVE', glyph: CLOUD, port: ROUND },
  { label: 'SLACK', glyph: SLACK, port: ZIG },
  { label: 'CALENDAR', glyph: CALENDAR, port: PLUG },
];
/** The newcomer (index into SERVICES): absent until the last beat. */
const NEW = 4;

/** A solid T×T tile with soft corners and `glyph` punched out of its centre. */
function tileBits(T: number, glyph: Bits): Bits {
  const gh = glyph.length;
  const gw = glyph[0].length;
  const oy = Math.floor((T - gh) / 2);
  const ox = Math.floor((T - gw) / 2);
  const rows: string[] = [];
  for (let y = 0; y < T; y++) {
    let row = '';
    for (let x = 0; x < T; x++) {
      const corner = (x === 0 || x === T - 1) && (y === 0 || y === T - 1);
      const gy = y - oy;
      const gx = x - ox;
      const hole = gy >= 0 && gy < gh && gx >= 0 && gx < gw && glyph[gy][gx] === '#';
      row += corner || hole ? '.' : '#';
    }
    rows.push(row);
  }
  return rows;
}

type Size = {
  tile: number;
  tiles: Bits[];
  ports: Bits[];
  /** port width (across the tile edge) and depth (out from it) */
  pw: number;
  pd: number;
  appW: number;
  appH: number;
  appLabel: string;
  /** the app body: widths of its text lines, and its cursor (w, h) */
  lines: number[];
  cursor: Pt;
  /** spacing of the docks along the app's top / bottom edge */
  dockH: number;
  env: Bits;
  cardW: number;
  /** size of the card's folded corner */
  fold: number;
  /** the card spells out its two rules (LIST, CALL); else plain rule lines */
  rules: boolean;
  labels: boolean;
};

const BIG: Size = {
  tile: 11,
  tiles: SERVICES.map((s) => tileBits(11, s.glyph)),
  ports: PORTS_BIG,
  pw: 7,
  pd: 4,
  appW: 27,
  appH: 15,
  appLabel: 'AI APP',
  lines: [15, 9],
  cursor: [2, 3],
  dockH: 9,
  env: ENV_BIG,
  cardW: 21,
  fold: 4,
  rules: true,
  labels: true,
};
/** Shorter desktop boxes (small laptop screens): smaller tiles, labels kept. */
const MID: Size = {
  tile: 9,
  tiles: SERVICES.map((s) => tileBits(9, s.glyph)),
  ports: PORTS_SMALL,
  pw: 5,
  pd: 3,
  appW: 27,
  appH: 11,
  appLabel: 'AI APP',
  lines: [15],
  cursor: [2, 3],
  dockH: 9,
  env: ENV_BIG,
  cardW: 19,
  fold: 3,
  rules: true,
  labels: true,
};
const SMALL: Size = {
  tile: 9,
  tiles: SERVICES.map((s) => tileBits(9, s.glyph)),
  ports: PORTS_SMALL,
  pw: 5,
  pd: 3,
  appW: 11,
  appH: 11,
  appLabel: 'AI',
  lines: [4],
  cursor: [1, 2],
  dockH: 3,
  env: ENV_SMALL,
  cardW: 15,
  fold: 3,
  rules: false,
  labels: false,
};

/** Card rows: [title, rule, LIST, CALL, plug, height] (LIST/CALL unused without rules). */
function cardRows(S: Size) {
  // the title drops below the fold when it would touch it
  const title = Math.floor((S.cardW - 11) / 2) + 11 > S.cardW - S.fold ? S.fold : 2;
  const rule = title + 6;
  const list = rule + 2;
  const call = list + 6;
  const plug = S.rules ? call + 6 : rule + 2;
  return [title, rule, list, call, plug, plug + S.pd + 2] as const;
}

/**
 * Where a service sits (cells from the box centre, for the layout's reference
 * box), which way its port points, the app edge its messages use (and the slot
 * on it), its traffic phase, and — when not straight in — the direction its
 * messages approach that edge from.
 */
type Spot = { x: number; y: number; dir: Dir; side: Side; slot: number; phase: number; leave?: Dir; arrive?: Dir };
type Layout = { ref: Pt; app: Pt; svc: (Spot | null)[] };
/** Read act, beside the text (≈ 67×74): services above and below the app. */
const SIDE: Layout = {
  ref: [67, 74],
  app: [0, 0],
  svc: [
    { x: -19, y: -23, dir: 'd', side: 't', slot: -1, phase: 0 },
    { x: 19, y: -21, dir: 'd', side: 't', slot: 1, phase: 0.23 },
    { x: -20, y: 23, dir: 'u', side: 'b', slot: -1, phase: 0.46 },
    { x: 20, y: 21, dir: 'u', side: 'b', slot: 1, phase: 0.69 },
    { x: 0, y: -19, dir: 'd', side: 't', slot: 0, phase: 0.32 },
  ],
};
/**
 * Watch act, centred (≈ 134×72): services spread left and right of the app.
 * The upper two talk to the app's top edge (beside the newcomer's slot), the
 * lower two to its sides — so no two lanes cross, even in short boxes where
 * the lower tiles end up level with the app.
 */
const WIDE: Layout = {
  ref: [134, 72],
  app: [0, 9],
  svc: [
    { x: -50, y: -13, dir: 'r', side: 't', slot: -1, phase: 0 },
    { x: 47, y: -17, dir: 'l', side: 't', slot: 1, phase: 0.23 },
    { x: -48, y: 20, dir: 'r', side: 'l', slot: 0, phase: 0.46 },
    { x: 51, y: 18, dir: 'l', side: 'r', slot: 0, phase: 0.69 },
    { x: 0, y: -19, dir: 'd', side: 't', slot: 0, phase: 0.32 },
  ],
};
/**
 * Phones (≈ 50×45, often shorter): three services in the corners, the
 * newcomer in the fourth. The top pair share the middle of the app's top
 * edge, the bottom pair its sides (their tiles flank the app in short boxes);
 * every envelope heads inward first and lands from above. Envelopes leave a
 * little inward of each port, and every pair that shares a dock or a column
 * runs half a cycle apart, so they never meet.
 */
const MOBILE: Layout = {
  ref: [50, 45],
  app: [0, 2],
  svc: [
    { x: -20, y: -16, dir: 'd', side: 't', slot: 0, phase: 0, leave: 'r' },
    { x: 20, y: -16, dir: 'd', side: 't', slot: 0, phase: 0.5, leave: 'l' },
    { x: -20, y: 16, dir: 'u', side: 'l', slot: 0, phase: 0.5, leave: 'r', arrive: 'u' },
    null,
    { x: 20, y: 16, dir: 'u', side: 'r', slot: 0, phase: 0, leave: 'l', arrive: 'u' },
  ],
};

const easeIn = (x: number) => x * x * x;
const frac = (x: number) => x - Math.floor(x);
const on = (bits: Bits, r: number, c: number) => r >= 0 && r < bits.length && bits[r].charCodeAt(c) === 35;

/** Draw an upright bitmap ('#' = on) with its top-left at (x0, y0), on whole cells. */
function blit(g: G, bits: Bits, x0: number, y0: number, style: string, keep?: Keep) {
  g.fillStyle = style;
  for (let r = 0; r < bits.length; r++) {
    const row = bits[r];
    let c = 0;
    while (c < row.length) {
      if (row.charCodeAt(c) !== 35 || (keep && !keep(r, c))) {
        c++;
        continue;
      }
      let e = c + 1;
      while (e < row.length && row.charCodeAt(e) === 35 && (!keep || keep(r, e))) e++;
      g.fillRect(x0 + c, y0 + r, e - c, 1);
      c = e;
    }
  }
}

/**
 * Draw a tip-first port bitmap pointing `dir`, its bounding box's top-left at
 * (x0, y0) (pw × pd for up/down, pd × pw for left/right).
 */
function port(g: G, bits: Bits, x0: number, y0: number, dir: Dir, style: string, keep?: Keep) {
  const D = bits.length;
  g.fillStyle = style;
  for (let r = 0; r < D; r++) {
    for (let c = 0; c < bits[r].length; c++) {
      if (bits[r].charCodeAt(c) !== 35 || (keep && !keep(r, c))) continue;
      if (dir === 'u') g.fillRect(x0 + c, y0 + r, 1, 1);
      else if (dir === 'd') g.fillRect(x0 + c, y0 + D - 1 - r, 1, 1);
      else if (dir === 'l') g.fillRect(x0 + r, y0 + c, 1, 1);
      else g.fillRect(x0 + D - 1 - r, y0 + c, 1, 1);
    }
  }
}

/** A cubic Bézier through control points a, b, c, d at s. */
function bez(a: Pt, b: Pt, c: Pt, d: Pt, s: number): Pt {
  const u = 1 - s;
  const b0 = u * u * u;
  const b1 = 3 * u * u * s;
  const b2 = 3 * u * s * s;
  const b3 = s * s * s;
  return [b0 * a[0] + b1 * b[0] + b2 * c[0] + b3 * d[0], b0 * a[1] + b1 * b[1] + b2 * c[1] + b3 * d[1]];
}

/**
 * Cubic from a (leaving along da) to b (arriving from the db side), bowed
 * sideways by `bend`. The departure lead reaches no further than b lies along
 * it, so a path never overshoots its target's column or row on the way out.
 */
function curve(a: Pt, da: Pt, b: Pt, db: Pt, bend: number, s: number): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const h = Math.hypot(dx, dy) * 0.42;
  const h1 = Math.max(1, Math.min(h, dx * da[0] + dy * da[1]));
  const ox = -dy * bend;
  const oy = dx * bend;
  return bez(a, [a[0] + da[0] * h1 + ox, a[1] + da[1] * h1 + oy], [b[0] + db[0] * h + ox, b[1] + db[1] * h + oy], b, s);
}

/** The spec card: a document with a folded corner, MCP, its rules and the standard plug. */
function card(g: G, x0: number, y0: number, S: Size, a: number) {
  const W = S.cardW;
  const f = S.fold;
  const [title, rule, list, call, plug, H] = cardRows(S);
  const style = ACC(a);
  g.fillStyle = style;
  g.fillRect(x0, y0, W - f, 1);
  g.fillRect(x0, y0, 1, H);
  g.fillRect(x0, y0 + H - 1, W, 1);
  g.fillRect(x0 + W - 1, y0 + f, 1, H - f);
  // the fold: a diagonal edge and the flap's inner corner
  for (let k = 1; k < f; k++) g.fillRect(x0 + W - f + k - 1, y0 + k, 1, 1);
  g.fillRect(x0 + W - f, y0 + 1, 1, f - 1);
  g.fillRect(x0 + W - f, y0 + f - 1, f, 1);
  pixelText(g, 'MCP', x0 + Math.floor((W - 11) / 2), y0 + title, style);
  // a rule under the title, then the two things the spec defines
  g.fillStyle = style;
  g.fillRect(x0 + 3, y0 + rule, W - 6, 1);
  if (S.rules) {
    const lx = x0 + Math.floor((W - 15) / 2);
    pixelText(g, 'LIST', lx, y0 + list, style);
    pixelText(g, 'CALL', lx, y0 + call, style);
  }
  blit(g, S.ports[PLUG], x0 + (W - S.pw) / 2, y0 + plug, style);
}

type Geo = {
  tx: number;
  ty: number;
  /** label top-left (labels only) */
  lx: number;
  ly: number;
  /** the port in the side (a) and wide (b) layouts, and the one in charge now */
  a: Dir;
  b: Dir;
  dir: Dir;
  /** port bounding box top-left, for a, b and now */
  pa: Pt;
  pb: Pt;
  px: number;
  py: number;
  /** port tip: where packets and envelopes leave */
  tip: Pt;
  /** the dock: a point on the app's outer edge, its outward normal; the way messages leave and the side they arrive from */
  dock: Pt;
  dn: Pt;
  leave: Pt;
  arrive: Pt;
  side: Side;
  slot: number;
  phase: number;
};

const scene: Scene = {
  paint({ r, box, p, t, mobile }) {
    const g = r.begin();
    // tile, port and app sizes: big when the box is tall enough, else mid; small on phones
    const S = mobile ? SMALL : box.h >= 66 ? BIG : MID;
    const T = S.tile;
    const { pw, pd } = S;
    const ENV = S.env;
    const ew = ENV[0].length;
    const eh = ENV.length;
    const bar = 7;
    const top = Math.ceil(box.y);
    const bottom = Math.floor(box.y + box.h);
    const left = Math.ceil(box.x);
    const right = Math.floor(box.x + box.w);

    // ── layout: side ↔ wide blend by the box's shape (desktop), fixed on phones
    const wgt = mobile ? 0 : clamp((box.w / box.h - 0.9) / 0.96);
    const A = mobile ? MOBILE : SIDE;
    const B = mobile ? MOBILE : WIDE;
    /** how far the watch-act needs (room for the card above the app) apply */
    const stage = mobile ? 1 : wgt;
    const kx = box.w / lerp(A.ref[0], B.ref[0], wgt);
    const ky = box.h / lerp(A.ref[1], B.ref[1], wgt);
    const X = (a: number, b: number) => box.cx + lerp(a, b, wgt) * kx;
    const Y = (a: number, b: number) => box.cy + lerp(a, b, wgt) * ky;
    const appY = Y(A.app[1], B.app[1]);

    // ── beats
    const mismatch = 1 - range(0.15, 0.2, p);
    const cardA = range(0.17, 0.23, p) * (1 - range(0.47, 0.52, p));
    const pop = range(0.76, 0.81, p);

    // ── services: tile, label and port (the app's docks come once it is placed)
    const across = (T - pw) / 2;
    const portAt = (tx: number, ty: number, dir: Dir): Pt => [
      dir === 'l' ? tx - pd : dir === 'r' ? tx + T : tx + across,
      dir === 'u' ? ty - pd : dir === 'd' ? ty + T : ty + across,
    ];
    const geo: (Geo | null)[] = [];
    for (let i = 0; i < SERVICES.length; i++) {
      const sa = A.svc[i];
      const sb = B.svc[i];
      if (!sa || !sb) {
        geo.push(null);
        continue;
      }
      const main = wgt < 0.5 ? sa : sb;
      const has = (d: Dir) => sa.dir === d || sb.dir === d;
      // keep label + tile + port inside the box, whatever its size
      const cy0 = Y(sa.y, sb.y);
      const above = cy0 < appY;
      const lab = S.labels ? 7 : 0;
      const half = (T - 1) / 2;
      const up = half + (above ? lab : 0) + (has('u') ? pd : 0);
      const down = half + (above ? 0 : lab) + (has('d') ? pd : 0);
      const cy = Math.round(clamp(cy0, top + 2 + up, bottom - 3 - down));
      // (phones: a cell less margin at the sides — narrow screens need it for the lanes beside the app)
      const mx = mobile ? 1 : 2;
      const cx = Math.round(clamp(X(sa.x, sb.x), left + mx + half + (has('l') ? pd : 0), right - 1 - mx - half - (has('r') ? pd : 0)));
      const bob = Math.round(Math.sin(t * 0.5 + i * 1.9) * 0.9);
      const tx = cx - half;
      const ty = cy - half + bob;
      const lw = pixelTextWidth(SERVICES[i].label);
      const lx = clamp(tx + Math.round((T - lw) / 2), left + 2, right - 2 - lw);
      const ly = above ? ty - 7 : ty + T + 2;
      const pa = portAt(tx, ty, sa.dir);
      const pb = portAt(tx, ty, sb.dir);
      const dir = main.dir;
      const [px, py] = wgt < 0.5 ? pa : pb;
      const tip: Pt =
        dir === 'u' ? [tx + T / 2, ty - pd] : dir === 'd' ? [tx + T / 2, ty + T + pd] : dir === 'l' ? [tx - pd, ty + T / 2] : [tx + T + pd, ty + T / 2];
      geo.push({
        tx,
        ty,
        lx,
        ly,
        a: sa.dir,
        b: sb.dir,
        dir,
        pa,
        pb,
        px,
        py,
        tip,
        dock: [0, 0],
        dn: VEC[main.side],
        leave: VEC[main.leave ?? main.dir],
        arrive: VEC[main.arrive ?? main.side],
        side: main.side,
        slot: main.slot,
        phase: main.phase,
      });
    }

    // ── the app window: in a short box it moves down to leave room above it
    //    for the spec card and (wide box) the newcomer's messages
    const [, , , , plugRow, cardH] = cardRows(S);
    const acx = Math.round(X(A.app[0], B.app[0]));
    const ay00 = Math.round(appY - (S.appH - 1) / 2);
    let need = top + 1 + cardH + 2;
    const nw = geo[NEW];
    if (nw && nw.side === 't') need = Math.max(need, Math.round(nw.tip[1]) + eh + 6);
    const want = Math.max(ay00, Math.min(need, bottom - 2 - S.appH));
    const ay0 = Math.round(lerp(ay00, want, stage));
    const ax0 = acx - (S.appW - 1) / 2;
    const appCx = ax0 + S.appW / 2;

    // docks: side docks sit beside the app's body (never its title bar), the
    // upper slot just under the bar, the lower one at the bottom; a service
    // clearly above or below its dock comes in on the diagonal from there, so
    // it never crosses the lane of the one level with it
    for (let i = 0; i < geo.length; i++) {
      const o = geo[i];
      if (!o) continue;
      if (o.side === 'l' || o.side === 'r') {
        const y0 = ay0 + bar;
        const y1 = Math.max(y0, ay0 + S.appH - 1 - eh);
        o.dock = [o.side === 'l' ? ax0 : ax0 + S.appW, (o.slot <= 0 ? y0 : y1) + eh / 2];
        const sp = (wgt < 0.5 ? A : B).svc[i]!;
        const dy = o.tip[1] - o.dock[1];
        if (!sp.arrive && Math.abs(dy) > eh) o.arrive = [o.dn[0] * Math.SQRT1_2, Math.sign(dy) * Math.SQRT1_2];
      } else {
        o.dock = [appCx + o.slot * S.dockH, o.side === 't' ? ay0 : ay0 + S.appH];
      }
    }

    // ── the card, and its stamps: every present service, then the app
    const cx0 = acx - (S.cardW - 1) / 2;
    const cy0 = Math.max(top + 1, Math.round((top + ay0 - cardH) / 2));
    const plugCx = cx0 + S.cardW / 2;
    const plugCy = cy0 + plugRow + pd / 2;
    /** how low the stamp copies dip leaving the card: under its foot, above the app */
    const dropY = Math.max(plugCy, Math.min(cy0 + cardH + 3, ay0 - 3));
    const order: number[] = [];
    for (let i = 0; i < SERVICES.length; i++) if (i !== NEW && geo[i]) order.push(i);
    const slotW = 0.225 / (order.length + 1);
    const stamp = (k: number) => range(0.235 + k * slotW, 0.235 + (k + 1) * slotW, p);
    const stampOf = (i: number) => stamp(order.indexOf(i));
    const appLand = range(0.6, 1, stamp(order.length));

    /** a message for the app's top (bottom) edge never dips below (above) its landing row */
    const beyond = (side: Side, y: number, land: number) => (side === 't' ? Math.min(y, land) : side === 'b' ? Math.max(y, land) : y);

    // ── before the spec: each service's own shape flies at the app and
    //    bounces off; a "?" pops up where it hit
    if (mismatch > 0) {
      // during the glide the docks swap edges: let the packets fade through it
      const glide = mobile ? 1 : clamp(Math.abs(wgt - 0.5) / 0.1);
      const a = mismatch * glide;
      for (const i of order) {
        const o = geo[i]!;
        const ph = frac(t * 0.2 + p * 1.5 + i * 0.27 + 0.2);
        const vert = o.dir === 'u' || o.dir === 'd';
        const bw = vert ? pw : pd;
        const bh = vert ? pd : pw;
        // they turn back just short of the app's edge
        const off = (o.dn[0] !== 0 ? bw : bh) / 2 + 1;
        const wall: Pt = [o.dock[0] + o.dn[0] * off, o.dock[1] + o.dn[1] * off];
        // they set off a cell clear of their own port
        const v = VEC[o.dir];
        const lift = (vert ? bh : bw) / 2 + 1;
        const from: Pt = [o.tip[0] + v[0] * lift, o.tip[1] + v[1] * lift];
        const s = ph < 0.55 ? easeIn(ph / 0.55) : 1 - easeOut((ph - 0.55) / 0.45);
        // (no packet on a lane too short for it to travel, or whose end
        // would sit against its own port — beside the text the gaps are tight)
        const wx = Math.round(wall[0] - bw / 2);
        const wy = Math.round(wall[1] - bh / 2);
        const apart = Math.max(o.px - wx - bw, wx - o.px - bw, o.py - wy - bh, wy - o.py - bh) >= 1;
        const room = apart && Math.hypot(wall[0] - from[0], wall[1] - from[1]) > 4;
        if (room && s > 0.08 && a > 0) {
          const [x, y] = curve(from, v, wall, o.arrive, 0.08, s);
          port(g, S.ports[SERVICES[i].port], Math.round(x - bw / 2), Math.round(beyond(o.side, y, wall[1]) - bh / 2), o.dir, INK(a));
        }
        const huh = range(0.68, 0.74, ph) * (1 - range(0.86, 0.97, ph)) * a;
        if (huh > 0) {
          const hx = o.side === 'l' ? o.dock[0] - 4 : o.side === 'r' ? o.dock[0] + 1 : Math.round(o.dock[0] - 1.5);
          const hy = o.side === 't' ? o.dock[1] - 6 : o.side === 'b' ? o.dock[1] + 1 : Math.round(o.dock[1] - 2.5);
          blit(g, HUH, hx, hy, INK(1), (rr, c) => hash2(rr, c, 61 + i) < huh);
        }
      }
    }

    // ── after the spec: envelopes fly freely both ways, from a cell beyond a
    //    port's tip to a cell short of the app's edge
    for (let i = 0; i < SERVICES.length; i++) {
      const o = geo[i];
      if (!o) continue;
      // (top-edge lanes run under the card: they wait until it has gone);
      // each lane's first envelope dissolves in rather than popping up mid-air
      const start = i === NEW ? 0.8 : (o.side === 't' ? 0.52 : 0.46) + i * 0.012;
      const born = range(start, start + 0.025, p);
      if (born <= 0) continue;
      const v = VEC[o.dir];
      const half = (v[0] !== 0 ? ew : eh) / 2 + 1;
      // (on phones a little inward, clear of the port across the gap)
      const lean = mobile && v[0] === 0 ? clamp(appCx - o.tip[0], -6, 6) : 0;
      const from: Pt = [o.tip[0] + v[0] * half + lean, o.tip[1] + v[1] * half];
      const reach = (o.dn[0] !== 0 ? ew : eh) / 2 + 1;
      const to: Pt = [o.dock[0] + o.dn[0] * reach, o.dock[1] + o.dn[1] * reach];
      // one envelope per service, ping-ponging: a reply to the app, then a
      // request back out, each on its own bow, with a short rest at each end
      const ph = frac(t * 0.17 + p * 2 + o.phase);
      const k = ph < 0.5 ? 0 : 1;
      const leg = (ph - k * 0.5) / 0.44;
      if (leg >= 1) continue;
      const s = easeInOut(leg);
      // (phones: barely bowed — the lanes between tiles and app are narrow)
      const bow = mobile ? 0.03 : 0.1;
      const [x, y] = k === 0 ? curve(from, o.leave, to, o.arrive, bow, s) : curve(from, o.leave, to, o.arrive, -bow, 1 - s);
      blit(g, ENV, Math.round(x - ew / 2), Math.round(beyond(o.side, y, to[1]) - eh / 2), ACC(1), born < 1 ? (rr, c) => hash2(rr, c, 29 + i) < born : undefined);
    }

    // ── the app: title bar (ink, then accent once stamped) with its label knocked out
    if (appLand <= 0 || appLand >= 1) {
      g.fillStyle = appLand >= 1 ? ACC(1) : INK(1);
      g.fillRect(ax0 + 1, ay0, S.appW - 2, 1);
      g.fillRect(ax0, ay0 + 1, S.appW, bar - 1);
    } else {
      // the stamp lands: the bar turns accent cell by cell
      for (let y = 0; y < bar; y++) {
        for (let x = 0; x < S.appW; x++) {
          if (y === 0 && (x === 0 || x === S.appW - 1)) continue;
          g.fillStyle = hash2(x, y, 41) < appLand ? ACC(1) : INK(1);
          g.fillRect(ax0 + x, ay0 + y, 1, 1);
        }
      }
    }
    g.globalCompositeOperation = 'destination-out';
    pixelText(g, S.appLabel, ax0 + (S.appW - pixelTextWidth(S.appLabel)) / 2, ay0 + 1, '#000');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = INK(1);
    g.fillRect(ax0, ay0 + bar, 1, S.appH - bar - 1);
    g.fillRect(ax0 + S.appW - 1, ay0 + bar, 1, S.appH - bar - 1);
    g.fillRect(ax0 + 1, ay0 + S.appH - 1, S.appW - 2, 1);
    // body: a reply being written, with a softly pulsing cursor after it
    const bx0 = ax0 + 2 + (S.labels ? 1 : 0);
    const by0 = ay0 + bar + (S.appH > 11 ? 2 : 1);
    g.fillStyle = INK(0.6);
    for (let j = 0; j < S.lines.length; j++) g.fillRect(bx0, by0 + j * 2, S.lines[j], 1);
    const last = S.lines.length - 1;
    g.fillStyle = INK(blink(t));
    g.fillRect(bx0 + S.lines[last] + (S.labels ? 2 : 1), by0 + last * 2 - Math.floor(S.cursor[1] / 2), S.cursor[0], S.cursor[1]);

    // ── stamp targets: a service's port, or (last) the whole app
    const target = (k: number) => {
      const o = k < order.length ? geo[order[k]]! : null;
      // (into the app the plug goes from above, prongs first)
      const dir: Dir = o ? o.dir : 'd';
      const vert = dir === 'u' || dir === 'd';
      return {
        o,
        dir,
        bx: o ? o.px : ax0,
        by: o ? o.py : ay0,
        bw: o ? (vert ? pw : pd) : S.appW,
        bh: o ? (vert ? pd : pw) : S.appH,
      };
    };
    // once a copy lands, a ring flashes out from it (drawn under the tiles,
    // which hide it where it crosses them; around the app it stays clear of the card)
    for (let k = 0; k <= order.length; k++) {
      const land = range(0.6, 1, stamp(k));
      if (land <= 0 || land >= 1) continue;
      const { o, bx, by, bw, bh } = target(k);
      // (it stays inside the box, and around the app clear of the card)
      const edge = Math.min(bx - left, by - top, right - bx - bw, bottom - by - bh) - 1;
      const room = Math.min(edge, o ? 4 : Math.max(1, ay0 - (cy0 + cardH) - 1));
      const grow = Math.min(room, 1 + Math.round(land * 3));
      if (grow < 1) continue;
      g.lineWidth = 1;
      g.strokeStyle = ACC(0.9 * (1 - land));
      g.strokeRect(bx - grow + 0.5, by - grow + 0.5, bw + grow * 2 - 1, bh + grow * 2 - 1);
    }

    // ── service tiles, labels and ports
    const plug = S.ports[PLUG];
    // the side and wide port orientations dissolve into each other mid-glide
    const swap = range(0.4, 0.6, wgt);
    for (let i = 0; i < SERVICES.length; i++) {
      const o = geo[i];
      if (!o) continue;
      const svc = SERVICES[i];
      const isNew = i === NEW;
      if (isNew && pop <= 0) continue;
      const reveal: Keep | undefined = isNew ? (rr, c) => hash2(rr, c, 77) < pop : undefined;
      // tiles sit in front: clear whatever passed beneath first
      if (!isNew) {
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        g.fillRect(o.tx, o.ty, T, T);
        g.globalCompositeOperation = 'lighter';
      }
      blit(g, S.tiles[i], o.tx, o.ty, INK(1), reveal);
      if (S.labels) pixelText(g, svc.label, o.lx, o.ly, INK(isNew ? pop : 1));
      // the port: its own shape until the stamp lands, then the standard plug
      const old = S.ports[svc.port];
      const land = isNew ? 1 : range(0.6, 1, stampOf(i));
      const draw = (x: number, y: number, dir: Dir, vis?: Keep) => {
        const keep = reveal ?? vis;
        if (land > 0) port(g, plug, x, y, dir, ACC(1), keep);
        if (land < 1) {
          port(g, old, x, y, dir, INK(1), (rr, c) => (land <= 0 || (!on(plug, rr, c) && hash2(rr, c, 13 + i) >= land)) && (!keep || keep(rr, c)));
        }
      };
      if (o.a === o.b || swap >= 1) draw(o.pb[0], o.pb[1], o.b);
      else if (swap <= 0) draw(o.pa[0], o.pa[1], o.a);
      else {
        draw(o.pa[0], o.pa[1], o.a, (rr, c) => hash2(rr, c, 5 + i) >= swap);
        draw(o.pb[0], o.pb[1], o.b, (rr, c) => hash2(rr, c, 5 + i) < swap);
      }
    }

    // ── the spec card, and the plug copies in flight
    if (cardA > 0) card(g, cx0, cy0, S, cardA);
    for (let k = 0; k <= order.length; k++) {
      const st = stamp(k);
      const fly = range(0, 0.6, st);
      if (st <= 0 || fly >= 1) continue;
      const { o, dir, bx, by, bw, bh } = target(k);
      // a copy of the plug drops out of the card's foot (never across its
      // text), swings over — out past the app's side when its port is lower
      // down — and comes in from the side the port faces, turning to match
      const e = easeInOut(fly);
      const fd: Dir = e < 0.5 ? 'u' : dir;
      const fw = fd === 'u' || fd === 'd' ? pw : pd;
      const fh = fd === 'u' || fd === 'd' ? pd : pw;
      const ex = o ? bx + bw / 2 : acx + 0.5;
      const ey = o ? by + bh / 2 : ay0 + 1 + pd / 2;
      const v = VEC[o ? dir : 'u'];
      const swing = o && ey > ay0 ? Math.sign(ex - plugCx) * (S.appW / 2 + 4) : 0;
      const [x, y] = bez([plugCx, plugCy], [plugCx + swing, dropY], [ex + v[0] * 6, ey + v[1] * 6], [ex, ey], e);
      port(g, plug, Math.round(x - fw / 2), Math.round(y - fh / 2), fd, ACC(1));
    }

    // ── the newcomer's arrival: a ring around its label, tile and port, kept in the box
    const ring = range(0.78, 0.86, p);
    const nc = geo[NEW];
    if (nc && ring > 0 && ring < 1) {
      const vert = nc.dir === 'u' || nc.dir === 'd';
      const lw = pixelTextWidth(SERVICES[NEW].label);
      let x0 = Math.min(nc.tx, nc.px);
      let y0 = Math.min(nc.ty, nc.py);
      let x1 = Math.max(nc.tx + T, nc.px + (vert ? pw : pd));
      let y1 = Math.max(nc.ty + T, nc.py + (vert ? pd : pw));
      if (S.labels) {
        x0 = Math.min(x0, nc.lx);
        y0 = Math.min(y0, nc.ly);
        x1 = Math.max(x1, nc.lx + lw);
        y1 = Math.max(y1, nc.ly + 5);
      }
      // grow outward; a side the box edge stops short of the group is left open
      const grow = 2 + Math.round(ring * 3);
      const rx0 = Math.max(left + 1, x0 - grow);
      const ry0 = Math.max(top + 1, y0 - grow);
      const rx1 = Math.min(right - 2, x1 - 1 + grow);
      const ry1 = Math.min(bottom - 2, y1 - 1 + grow);
      // (the sides stop short of the top and bottom rows: no doubled corners)
      const t0 = ry0 < y0;
      const b0 = ry1 >= y1;
      const sy0 = t0 ? ry0 + 1 : ry0;
      const sy1 = b0 ? ry1 - 1 : ry1;
      g.fillStyle = ACC(0.9 * (1 - ring));
      if (t0) g.fillRect(rx0, ry0, rx1 - rx0 + 1, 1);
      if (b0) g.fillRect(rx0, ry1, rx1 - rx0 + 1, 1);
      if (rx0 < x0) g.fillRect(rx0, sy0, 1, sy1 - sy0 + 1);
      if (rx1 >= x1) g.fillRect(rx1, sy0, 1, sy1 - sy0 + 1);
    }

    r.commit();
  },
};

export default scene;
