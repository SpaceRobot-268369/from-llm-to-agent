/**
 * agentfiles — memory as a knowledge base of files. One part is a pixel file
 * tree: the AGENTS.MD index card at the root, a trunk with three folder rows
 * on branches (CONTEXT, MEMORY, SKILLS), each a solid folder icon and its
 * name. Opening a folder expands it like a file explorer: its files roll down
 * under it as leaves on their own branches (SPEC, SETUP · NOTES · STEPS) and
 * push the folders below down; closing rolls them back up. The other part is
 * the AGENT: a session window that starts empty, with a softly pulsing cursor.
 *
 * p (scene progress) tells the story:
 *   0    – 0.27  read first: the index card lights up in accent (a wipe), a
 *                short stream of accent dashes flows from it into the window
 *                and types the first rows; then the card settles to an accent
 *                outline (it stays loaded) and the rows turn to ink.
 *   0.27 – 0.48  on demand, CONTEXT: the folder is selected (an ink bar, its
 *                name knocked out) and expands; its first file lights up
 *                (accent bar) and a page (accent) slides out of it to the
 *                window; the agent types what it read; the page goes back,
 *                the folder collapses.
 *   0.48 – 0.69  the same for SKILLS: a page of steps (bullets).
 *   0.69 – 0.95  write back: MEMORY is selected and expands to show NOTES;
 *                the agent types a new line (accent); a copy flies out of the
 *                window into NOTES (the line stays, in ink); NOTES glows
 *                accent and fades back, keeping its name lit (updated).
 *                MEMORY stays expanded.
 *   0.95 – 1     hold.
 * t only pulses the cursor; everything reads at t = 0. On phones the same
 * story loops in time instead of following the scroll (loopP).
 *
 * Arrangements: the tree BESIDE the window ('h', most boxes), or ABOVE it
 * ('v', tall narrow desktop boxes such as 1024×768). Pages, the stream and the
 * note travel only in the corridor between the tree's rows and the window (a
 * column right of the rows), so nothing in flight covers a row; they slide out
 * from behind a file's bar and in from behind the window's border.
 *
 * Kits (whole cells, the largest that fits, cached per box size): ROOMY and
 * MID (desktop side box: selection bars, 2-cell text rows, an AGENT label over
 * the window), VERT2 / VERT (the vertical arrangement: 1-cell rows and AGENT
 * knocked out of a taller title bar, worth an index row; VERT shows one file
 * per folder), COMPACT (phones: no bars — an open folder turns hollow, a lit
 * file turns accent), TINY / TINIER (short phones: a solid card, one file per
 * folder, the tightest gaps).
 */
import { easeInOut, hash2, lerp, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, blink, pixelText, pixelTextWidth } from './helpers';

type G = CanvasRenderingContext2D;

const INDEX = 'AGENTS.MD';
const AGENT = 'AGENT';
const FOLDERS = ['CONTEXT', 'MEMORY', 'SKILLS'] as const;
/** Each folder's files (the tree's leaves, illustrative), shown while it is expanded; small kits show fewer. */
const LEAVES: readonly (readonly string[])[] = [['SPEC', 'SETUP'], ['NOTES'], ['STEPS']];
const MEM = 1;
/** Pixel-font glyph height (cells). */
const FONT_H = 5;
/** Settled text rows: mid-tone ink, secondary to the outlines and labels (1-cell rows stay solid). */
const ROW_INK = 0.7;

// ── beats (scene progress) ──────────────────────────────────────────────
/** The index card lights up (wipe). */
const LIT: [number, number] = [0.03, 0.07];
/** The stream of dashes: first dash leaves, spacing window, flight time. */
const STREAM0 = 0.07;
const STREAM_SPAN = 0.11;
const STREAM_FLY = 0.05;
/** The card settles to an outline, the index rows to ink. */
const SETTLE: [number, number] = [0.23, 0.27];
/** One on-demand visit: the folder, its file that is read, its rows' kind, and when it starts. */
type Visit = { folder: number; leaf: number; steps: boolean; at: number };
const VISITS: Visit[] = [
  { folder: 0, leaf: 0, steps: false, at: 0.27 },
  { folder: 2, leaf: 0, steps: true, at: 0.48 },
];
// a visit's steps, as offsets from its start
/** the folder's bar wipes in */
const SEL = 0.03;
/** the files roll down */
const EXP: [number, number] = [0.01, 0.04];
/** the file's accent bar wipes in */
const LEAF_ON = 0.035;
/** the page slides out to the window */
const OUT = 0.045;
const SLIDE_LEN = 0.04;
/** the agent types two rows */
const READ = 0.09;
const READ_LEN = 0.04;
/** the page slides back, the file goes dark, the folder collapses (its bar wipes out) */
const BACK = 0.13;
const LEAF_OFF = 0.165;
const CLOSE = 0.175;
const CLOSE_LEN = 0.03;
/** Write back: MEMORY is selected and expands; the note is typed, then flown into NOTES. */
const MEM_AT = 0.69;
const NOTE_TYPE: [number, number] = [0.71, 0.76];
const NOTE_FLY: [number, number] = [0.77, 0.85];
/** NOTES glows accent (wipe in from the right), then fades back; MEMORY's bar wipes out. */
const GLOW_IN: [number, number] = [0.84, 0.87];
const GLOW_OUT: [number, number] = [0.89, 0.95];
const MEM_OFF: [number, number] = [0.9, 0.93];

/**
 * Phones: the art band is only in clear view before the copy scrolls over it,
 * so there the story plays on a loop in time (as in `system`) — wait, play,
 * hold the finished picture, then cut back to an empty window (a new
 * session). t = 0 (reduced motion) holds the finished picture.
 */
const LOOP = 12;
function loopP(t: number): number {
  if (t === 0) return 1;
  const s = t % LOOP;
  if (s < 0.8) return 0;
  return Math.min(1, (s - 0.8) / 8.4);
}

// ── kits ────────────────────────────────────────────────────────────────

type Arr = 'h' | 'v';

type Kit = {
  /** a solid card (no outline: the tiny kits), its padding around the label, the dog-ear size */
  solid: boolean;
  cpx: number;
  cpy: number;
  ear: number;
  /**
   * The tree, as offsets from the card's left edge: the trunk; a folder's icon
   * (x, width) and the gap before its name; a folder's own trunk; a file's
   * icon (x, width).
   */
  trunk: number;
  fx: number;
  fw: number;
  gi: number;
  sx: number;
  lx: number;
  lw: number;
  /** row pitches (folders, files), selection-bar padding (folders, files; 0 = no bars), gap under the card */
  pitchF: number;
  pitchL: number;
  bp: number;
  bpL: number;
  g0: number;
  /** most files shown per folder */
  leaves: number;
  /** page size, and the clearance between the rows and the corridor it travels in */
  pw: number;
  ph: number;
  clear: number;
  /** text rows: height, pitch, extra space between groups; window title bar (solid rows) */
  row: number;
  pitch: number;
  group: number;
  bar: number;
  /** window width bounds (beside the tree) */
  wwMin: number;
  wwMax: number;
  /** most extra cells a gap may take */
  gMax: number;
  /** index rows typed by the stream (at most; fewer when the window needs the room), and its dashes */
  nIdx: number;
  dashes: number;
  /** cursor size */
  cur: [number, number];
  /** an AGENT label: over the window ('h'), or knocked out of a taller title bar ('v') */
  label: boolean;
  /** smallest margin (cells) when space is tight */
  m0: number;
};

const ROOMY: Kit = {
  solid: false,
  cpx: 2, cpy: 2, ear: 2,
  trunk: 2, fx: 5, fw: 7, gi: 2, sx: 6, lx: 9, lw: 4,
  pitchF: 8, pitchL: 8, bp: 1, bpL: 1, g0: 3,
  leaves: 2,
  pw: 6, ph: 7, clear: 1,
  row: 2, pitch: 3, group: 2, bar: 3,
  wwMin: 13, wwMax: 21,
  gMax: 1,
  nIdx: 3,
  dashes: 6,
  cur: [2, 2],
  label: true,
  m0: 1,
};

/** Smaller desktop boxes: tighter padding and indents, a smaller page. */
const MID: Kit = { ...ROOMY, cpx: 1, trunk: 1, fx: 3, fw: 6, gi: 1, sx: 4, lx: 7, pw: 5, wwMin: 11 };

/** Tall narrow desktop boxes (tree above the window): 1-cell text rows, a shorter card. */
const VERT2: Kit = { ...MID, cpy: 1, g0: 2, pitchF: 7, row: 1, pitch: 2, group: 1, bar: 2, nIdx: 2, dashes: 4, cur: [2, 1], gMax: 2, m0: 0 };
/** …with one file per folder, and no extra space between the text-row groups. */
const VERT: Kit = { ...VERT2, leaves: 1, group: 0 };

/** Phones: no selection bars, 1-cell rows, the trunk on the card's edge. */
const COMPACT: Kit = {
  solid: false,
  cpx: 1, cpy: 1, ear: 1,
  trunk: 0, fx: 2, fw: 5, gi: 1, sx: 3, lx: 5, lw: 3,
  pitchF: 7, pitchL: 6, bp: 0, bpL: 0, g0: 1,
  leaves: 2,
  pw: 4, ph: 5, clear: 0,
  row: 1, pitch: 2, group: 1, bar: 2,
  wwMin: 8, wwMax: 12,
  gMax: 2,
  nIdx: 2,
  dashes: 4,
  cur: [2, 1],
  label: false,
  m0: 0,
};

/** Short phones: a solid index card, one file per folder, folder rows closer. */
const TINY: Kit = { ...COMPACT, solid: true, pitchF: 6, leaves: 1, wwMin: 7, m0: 1 };
/** The smallest phones: the folders right under the card, no margin. */
const TINIER: Kit = { ...TINY, g0: 0, m0: 0 };

const KITS: [Kit, Arr][] = [
  [ROOMY, 'h'],
  [MID, 'h'],
  [MID, 'v'],
  [VERT2, 'v'],
  [VERT, 'v'],
  [COMPACT, 'h'],
  [TINY, 'h'],
  [TINIER, 'h'],
];

type Lay = Kit & {
  arr: Arr;
  x0: number;
  y0: number;
  /** card size */
  cw: number;
  ch: number;
  /** files shown per folder; the first folder row's top */
  nL: number[];
  fy0: number;
  wx: number;
  wy: number;
  ww: number;
  wh: number;
  /** the AGENT label over the window (top-left), or labelY = -1 */
  labelX: number;
  labelY: number;
  textX: number;
  textW: number;
  /** text rows (top y): index…, context ×2, skills ×2, the memory note */
  rows: number[];
  /** the corridor's left edge: pages travel (and dock) at x = cx */
  cx: number;
};

function fit(box: Box, k: Kit, arr: Arr, force = false): Lay | null {
  const bx0 = Math.ceil(box.x);
  const bx1 = Math.floor(box.x + box.w);
  const by0 = Math.ceil(box.y);
  const by1 = Math.floor(box.y + box.h);
  const bw = bx1 - bx0;
  const bhh = by1 - by0;
  const edge = k.solid ? 0 : 2;
  const cw = pixelTextWidth(INDEX) + 2 * k.cpx + edge;
  const ch = FONT_H + 2 * k.cpy + edge;
  const nL = LEAVES.map((l) => Math.min(k.leaves, l.length));
  // the rows' right edge (bars included)
  const fnx = k.fx + k.fw + k.gi;
  const lnx = k.lx + k.lw + k.gi;
  let rowsW = 0;
  for (let i = 0; i < 3; i++) {
    rowsW = Math.max(rowsW, fnx + pixelTextWidth(FOLDERS[i]) + k.bp);
    for (let j = 0; j < nL[i]; j++) rowsW = Math.max(rowsW, lnx + pixelTextWidth(LEAVES[i][j]) + k.bpL);
  }
  const maxEx = Math.max(...nL) * k.pitchL;

  // ── across
  let x0: number;
  let wx: number;
  let ww: number;
  let cx: number;
  let labelX = 0;
  let label = false;
  if (arr === 'h') {
    // tree · corridor · window
    const left = rowsW + k.clear + k.pw + 1;
    let mx = Math.round(bw * 0.06);
    ww = bw - 2 * mx - left;
    if (ww < k.wwMin) {
      mx = Math.max(k.m0, Math.floor((bw - left - k.wwMin) / 2));
      ww = bw - 2 * mx - left;
    }
    if (ww < k.wwMin && !force) return null;
    ww = Math.max(5, Math.min(ww, k.wwMax));
    const totalW = Math.max(cw, left + ww);
    x0 = bx0 + Math.floor((bw - totalW) / 2);
    // the AGENT label goes over the window, between the card and the box's edge: shift left to make room
    const lw = pixelTextWidth(AGENT);
    if (k.label) x0 = Math.max(bx0, Math.min(x0, bx1 - lw - cw - 1));
    wx = x0 + left;
    cx = wx - 1 - k.pw;
    // centred over the window when it can be, else kept inside the box and clear of the card
    labelX = Math.max(x0 + cw + 1, Math.min(Math.round(wx + ww / 2 - lw / 2), bx1 - lw));
    label = k.label && labelX + lw <= bx1;
  } else {
    // the tree with the corridor on its right; the window under both
    const totalW = Math.max(cw, rowsW + k.clear + k.pw);
    if (totalW > bw - 2 * k.m0 && !force) return null;
    x0 = bx0 + Math.floor((bw - totalW) / 2);
    wx = x0;
    ww = totalW;
    cx = x0 + totalW - k.pw;
  }

  // ── down: heights from y0, for n index rows, a title bar and `add` extra cells per gap
  const pad = k.row > 1 ? 2 : 1;
  const winH = (n: number, bar: number) => bar + 2 * pad + (n + 4) * k.pitch + k.row + 3 * k.group + 1;
  const measure = (n: number, bar: number, add: number) => {
    // the tree at its tallest (the most files open), and at rest at the end (MEMORY open)
    const treeH0 = ch + k.g0 + add + 2 * (k.pitchF + add) + FONT_H;
    const treeH = treeH0 + maxEx;
    if (arr === 'v') {
      const top = treeH + 2 + add;
      return { H: top + winH(n, bar), top, bot: top + winH(n, bar) };
    }
    // under its label; else level with the card when the corridor clears the card (pages dock
    // beside the first rows), or level with the first folder
    const top = label ? FONT_H + 2 : cx > x0 + cw ? 0 : ch + k.g0 + add - k.bp;
    const bot = Math.max(treeH0 + nL[MEM] * k.pitchL, top + winH(n, bar));
    return { H: Math.max(treeH, bot), top, bot };
  };
  // margins: 7% of the box, shrunk (down to m0) when that is too tight; null if H does not fit
  const place = (H: number) => {
    let my = Math.round(bhh * 0.07);
    if (bhh - 2 * my < H) my = Math.max(k.m0, Math.floor((bhh - H) / 2));
    return bhh - 2 * my >= H ? { my, avail: bhh - 2 * my } : null;
  };
  // the most index rows that fit; in the vertical arrangement, a title bar with AGENT knocked
  // out is worth an index row
  const tall = FONT_H + 2;
  let n = k.nIdx;
  let bar = k.bar;
  let at = null as ReturnType<typeof place>;
  for (const b of arr === 'v' && k.label ? [tall, k.bar] : [k.bar]) {
    for (n = k.nIdx; n >= 1 && !(at = place(measure(n, b, 0).H)); n--);
    if (at) {
      bar = b;
      break;
    }
  }
  if (!at) {
    if (!force) return null;
    n = 1;
    at = { my: k.m0, avail: bhh - 2 * k.m0 };
  }
  const { my, avail } = at;
  // spare rows widen the gaps
  let add = Math.max(0, Math.min(k.gMax, Math.floor((avail - measure(n, bar, 0).H) / 3)));
  while (add > 0 && measure(n, bar, add).H > avail) add--;
  const m = measure(n, bar, add);
  const y0 = by0 + my + Math.floor((avail - m.H) / 2);
  const wy = y0 + m.top;
  const wh = m.bot - m.top;

  // ── the window's text rows: the index rows, then a group per visit, then the note
  const r0 = wy + bar + pad;
  const rows: number[] = [];
  for (let i = 0; i < n; i++) rows.push(r0 + i * k.pitch);
  let y = rows[n - 1];
  for (const size of [2, 2, 1]) {
    y += k.group;
    for (let j = 0; j < size; j++) rows.push((y += k.pitch));
  }

  return {
    ...k,
    pitchF: k.pitchF + add,
    g0: k.g0 + add,
    bar,
    nIdx: n,
    arr,
    x0,
    y0,
    cw,
    ch,
    nL,
    fy0: y0 + ch + k.g0 + add,
    wx,
    wy,
    ww,
    wh,
    labelX,
    labelY: label ? y0 : -1,
    textX: wx + 2,
    textW: ww - 4,
    rows,
    cx,
  };
}

const layCache = new Map<string, Lay>();
function layout(box: Box): Lay {
  const key = `${box.x.toFixed(1)}|${box.y.toFixed(1)}|${box.w.toFixed(1)}|${box.h.toFixed(1)}`;
  let L = layCache.get(key);
  if (L) return L;
  for (const [k, arr] of KITS) if ((L = fit(box, k, arr) ?? undefined)) break;
  L ??= fit(box, TINIER, 'h', true) as Lay;
  if (layCache.size > 32) layCache.clear();
  layCache.set(key, L);
  return L;
}

// ── pixel primitives (integer cells) ──────────────────────────────────────

function rect(g: G, x: number, y: number, w: number, h: number, style: string) {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = style;
  g.fillRect(x, y, w, h);
}

/** Erase to background (both channels), so accent can sit where ink was. */
function cut(g: G, x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000';
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'lighter';
}

/** Knock a pixel-font label out of whatever is under it. */
function knock(g: G, text: string, x: number, y: number) {
  g.globalCompositeOperation = 'destination-out';
  pixelText(g, text, x, y, '#000');
  g.globalCompositeOperation = 'lighter';
}

/** Run `fn` clipped to a rectangle (skipped when empty). */
function clipped(g: G, x: number, y: number, w: number, h: number, fn: () => void) {
  if (w <= 0 || h <= 0) return;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  fn();
  g.restore();
}

/**
 * A bar whose cells are accent or ink: each cell turns ink once its stable
 * random rank is under `inked` (a dissolve, no density dip halfway).
 */
function bar(g: G, x: number, y: number, w: number, h: number, inked: number) {
  if (w <= 0 || h <= 0) return;
  const ink = INK(h > 1 ? ROW_INK : 1);
  if (inked <= 0) return rect(g, x, y, w, h, ACC(1));
  if (inked >= 1) return rect(g, x, y, w, h, ink);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) rect(g, xx, yy, 1, 1, hash2(xx, yy, 13) < inked ? ink : ACC(1));
  }
}

/** A point `s` (0..1) of the way along a polyline, in whole cells. */
function along(pts: [number, number][], s: number): [number, number] {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let d = s * total;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (d <= len && len > 0) return [Math.round(lerp(ax, bx, d / len)), Math.round(lerp(ay, by, d / len))];
    d -= len;
  }
  const [x, y] = pts[pts.length - 1];
  return [Math.round(x), Math.round(y)];
}

// ── pieces ──────────────────────────────────────────────────────────────

/** The index card: a dog-eared page, outlined or solid, with its label. */
function card(g: G, L: Lay, mode: 'line' | 'solid', style: string) {
  const { x0: x, y0: y, cw, ch, ear: e } = L;
  const x1 = x + cw - 1;
  const y1 = y + ch - 1;
  const cx = x1 - e;
  const lx = x + (L.solid ? 0 : 1) + L.cpx;
  const ly = y + (L.solid ? 0 : 1) + L.cpy;
  if (mode === 'solid' || L.solid) {
    for (let j = 0; j < ch; j++) rect(g, x, y + j, j < e ? cx - x + 1 + j : cw, 1, style);
    knock(g, INDEX, lx, ly);
    return;
  }
  rect(g, x, y, cx - x + 1, 1, style);
  rect(g, x, y + 1, 1, ch - 1, style);
  rect(g, x + 1, y1, cw - 1, 1, style);
  rect(g, x1, y + e, 1, ch - e - 1, style);
  // the folded flap: a solid triangle under the fold
  for (let j = 1; j <= e; j++) rect(g, cx, y + j, j + 1, 1, style);
  pixelText(g, INDEX, lx, ly, style);
}

/** One tree row: an icon at x (folder or file), its name at nx; `pad` = its bar's padding. */
type Row = { x: number; y: number; iw: number; nx: number; name: string; file: boolean; pad: number };

/** A folder: solid (closed) or hollow (open), with a tab. A file: an outlined, dog-eared page. */
function icon(g: G, R: Row, style: string, open: boolean) {
  const { x, y, iw: w } = R;
  if (!R.file) {
    rect(g, x, y, Math.max(2, w >> 1), 1, style);
    if (!open) return rect(g, x, y + 1, w, FONT_H - 1, style);
    rect(g, x, y + 1, w, 1, style);
    rect(g, x, y + FONT_H - 1, w, 1, style);
    rect(g, x, y + 2, 1, FONT_H - 3, style);
    rect(g, x + w - 1, y + 2, 1, FONT_H - 3, style);
    return;
  }
  if (w >= 4) {
    rect(g, x, y, w - 1, 1, style);
    rect(g, x + w - 2, y + 1, 2, 1, style);
    rect(g, x, y + 1, 1, FONT_H - 1, style);
    rect(g, x + w - 1, y + 2, 1, FONT_H - 2, style);
    rect(g, x + 1, y + FONT_H - 1, w - 2, 1, style);
    return;
  }
  rect(g, x, y, 2, 1, style);
  rect(g, x, y + 1, 3, 1, style);
  rect(g, x, y + 2, 1, FONT_H - 2, style);
  rect(g, x + 2, y + 2, 1, FONT_H - 2, style);
  rect(g, x + 1, y + FONT_H - 1, 1, 1, style);
}

/** A row's bar box: [x, y, w, h]. */
function barBox(R: Row): [number, number, number, number] {
  return [R.x - R.pad, R.y - R.pad, R.nx + pixelTextWidth(R.name) + 2 * R.pad - R.x, FONT_H + 2 * R.pad];
}

/** The part [a, b) of a row's bar that shows, from a wipe in (fin) and a wipe out (fout), left to right. */
function wipe(R: Row, fin: number, fout: number): [number, number] {
  const [bx, , bw] = barBox(R);
  return [bx + Math.round(fout * bw), bx + Math.round(fin * bw)];
}

/**
 * A row: plain (icon and name in `style`), and over [a, b) a bar in `hi` with
 * the icon and name knocked out — or, without bar padding, the row redrawn in `hi`.
 */
function drawRow(g: G, R: Row, style: string, open: boolean, hi: string | null, a: number, b: number) {
  cut(g, R.x, R.y, R.nx + pixelTextWidth(R.name) - R.x, FONT_H);
  icon(g, R, style, open);
  pixelText(g, R.name, R.nx, R.y, style);
  if (!hi || b <= a) return;
  const [bx, by, bw, bh] = barBox(R);
  clipped(g, a, by, b - a, bh, () => {
    cut(g, bx, by, bw, bh);
    if (R.pad > 0) {
      rect(g, bx, by, bw, bh, hi);
      g.globalCompositeOperation = 'destination-out';
      icon(g, R, '#000', open);
      pixelText(g, R.name, R.nx, R.y, '#000');
      g.globalCompositeOperation = 'lighter';
    } else {
      icon(g, R, hi, open);
      pixelText(g, R.name, R.nx, R.y, hi);
    }
  });
}

function folderRow(L: Lay, i: number, y: number): Row {
  const x = L.x0 + L.fx;
  return { x, y, iw: L.fw, nx: x + L.fw + L.gi, name: FOLDERS[i], file: false, pad: L.bp };
}

function fileRow(L: Lay, i: number, j: number, fy: number): Row {
  const x = L.x0 + L.lx;
  return { x, y: fy + (j + 1) * L.pitchL, iw: L.lw, nx: x + L.lw + L.gi, name: LEAVES[i][j], file: true, pad: L.bpL };
}

/** Where a page sits when it is tucked behind a file's row (its right edge on the bar's). */
function tucked(L: Lay, R: Row): [number, number] {
  return [R.nx + pixelTextWidth(R.name) + R.pad - L.pw, R.y + (FONT_H >> 1) - (L.ph >> 1)];
}

/** A page in flight: accent, its text cut in dark (plain lines, or bullet steps). */
function page(g: G, x: number, y: number, w: number, h: number, steps: boolean, seed: number) {
  cut(g, x, y, w, h);
  rect(g, x, y, w, h, ACC(1));
  // dog-ear
  cut(g, x + w - 1, y, 1, 1);
  if (w >= 6) {
    cut(g, x + w - 2, y, 1, 1);
    cut(g, x + w - 1, y + 1, 1, 1);
  }
  const inner = w - 2;
  for (let ry = y + 2, j = 0; ry < y + h - 1; ry += 2, j++) {
    if (steps && inner >= 3) {
      cut(g, x + 1, ry, 1, 1);
      const lw = Math.max(1, Math.round((inner - 2) * (0.6 + 0.4 * hash2(j, seed, 3))));
      cut(g, x + 3, ry, lw, 1);
    } else {
      const lw = Math.max(1, Math.round(inner * (0.6 + 0.4 * hash2(j, seed, 3))));
      cut(g, x + 1, ry, lw, 1);
    }
  }
}

/** Length of text row i (ragged, stable). */
function rowLen(L: Lay, i: number, steps: boolean) {
  let max = L.textW - (steps ? L.row + 1 : 0);
  // no line below it inside the window: leave the cursor room at its end
  if (L.rows[i] + L.pitch + L.cur[1] > L.wy + L.wh - 2) max -= L.cur[0] + 1;
  return Math.max(2, Math.round(max * (0.5 + 0.4 * hash2(i, 7, 5))));
}

const scene: Scene = {
  paint({ r, box, p: scroll, t, mobile }) {
    const g = r.begin();
    const p = mobile ? loopP(t) : scroll;
    const L = layout(box);
    const { row, rows, textX, pw, ph, x0, y0, cx } = L;
    const { wx, wy, ww, wh } = L;
    const vert = L.arr === 'v';
    const nI = L.nIdx;
    const noteRow = nI + 4;

    // ── the window: outline, title bar, its label
    rect(g, wx, wy, ww, L.bar, INK(1));
    rect(g, wx, wy + wh - 1, ww, 1, INK(1));
    rect(g, wx, wy + L.bar, 1, wh - L.bar - 1, INK(1));
    rect(g, wx + ww - 1, wy + L.bar, 1, wh - L.bar - 1, INK(1));
    if (L.bar >= FONT_H + 2) knock(g, AGENT, Math.round(wx + ww / 2 - pixelTextWidth(AGENT) / 2), wy + 1);
    if (L.labelY >= 0) pixelText(g, AGENT, L.labelX, L.labelY, INK(1));

    // ── text rows: what the agent knows so far
    // [typed fraction, inked fraction] per row; the cursor follows the last
    const typed: number[] = new Array(rows.length).fill(0);
    const inked: number[] = new Array(rows.length).fill(0);
    // index rows: typed by the stream, each dash a piece of a row
    const N = L.dashes;
    const dashT = (i: number) => STREAM0 + (i * STREAM_SPAN) / (N - 1);
    const dashRow = (i: number) => Math.floor((i * nI) / N);
    for (let i = 0; i < N; i++) {
      const k = dashRow(i);
      const per = Math.floor(((k + 1) * N - 1) / nI) - Math.ceil((k * N) / nI) + 1;
      typed[k] += range(dashT(i) + STREAM_FLY * 0.8, dashT(i) + STREAM_FLY * 1.5, p) / per;
    }
    const settle = range(SETTLE[0], SETTLE[1], p);
    for (let k = 0; k < nI; k++) inked[k] = settle;
    // each visit types two rows while its page is docked
    for (let v = 0; v < VISITS.length; v++) {
      const V = VISITS[v];
      const read = range(V.at + READ, V.at + READ + READ_LEN, p) * 2;
      const ink = range(V.at + CLOSE, V.at + CLOSE + 0.04, p);
      for (let j = 0; j < 2; j++) {
        typed[nI + 2 * v + j] = Math.min(1, Math.max(0, read - j));
        inked[nI + 2 * v + j] = ink;
      }
    }
    // the memory note: typed in accent; as a copy flies off, the row stays (ink)
    const noteFly = range(NOTE_FLY[0], NOTE_FLY[1], p);
    typed[noteRow] = range(NOTE_TYPE[0], NOTE_TYPE[1], p);
    inked[noteRow] = range(NOTE_FLY[0], NOTE_FLY[0] + 0.03, p);

    let curX = textX;
    let curY = rows[0];
    for (let k = 0; k < rows.length; k++) {
      if (typed[k] <= 0) continue;
      const steps = k >= nI + 2 && k < nI + 4;
      const len = rowLen(L, k, steps);
      let x = textX;
      if (steps) {
        // a bullet: a step to run
        bar(g, x, rows[k], row, row, inked[k]);
        x += row + 1;
      }
      const w = Math.max(1, Math.round(len * typed[k]));
      bar(g, x, rows[k], w, row, inked[k]);
      curX = x + w + 1;
      curY = rows[k];
    }
    // a full row: the cursor waits at the start of the next one
    if (curX + L.cur[0] > wx + ww - 2) {
      curX = textX;
      curY += L.pitch;
    }
    rect(g, curX, curY, L.cur[0], L.cur[1], INK(blink(t)));

    // ── the index card: lights up, then settles to a lit outline
    const lit = range(LIT[0], LIT[1], p);
    cut(g, x0, y0, L.cw, L.ch);
    if (settle > 0) {
      const xs = x0 + Math.round(settle * L.cw);
      clipped(g, x0, y0, xs - x0, L.ch, () => card(g, L, 'line', ACC(1)));
      clipped(g, xs, y0, x0 + L.cw - xs, L.ch, () => card(g, L, 'solid', ACC(1)));
    } else if (lit > 0) {
      const xs = x0 + Math.round(lit * L.cw);
      clipped(g, x0, y0, xs - x0, L.ch, () => card(g, L, 'solid', ACC(1)));
      clipped(g, xs, y0, x0 + L.cw - xs, L.ch, () => card(g, L, 'line', INK(1)));
    } else card(g, L, 'line', INK(1));

    // ── the tree's state: how far each folder is expanded (cells), and where its row sits
    const ex = [0, 0, 0];
    for (const V of VISITS) {
      const e = range(V.at + EXP[0], V.at + EXP[1], p) - range(V.at + CLOSE, V.at + CLOSE + CLOSE_LEN, p);
      ex[V.folder] = Math.round(easeInOut(e) * L.nL[V.folder] * L.pitchL);
    }
    ex[MEM] = Math.round(easeInOut(range(MEM_AT + EXP[0], MEM_AT + EXP[1], p)) * L.nL[MEM] * L.pitchL);
    const fy = [L.fy0, 0, 0];
    for (let i = 1; i < 3; i++) fy[i] = fy[i - 1] + L.pitchF + ex[i - 1];
    /** the files' strip under folder i (rolls down as it expands) */
    const strip = (i: number, fn: () => void) =>
      clipped(g, x0, fy[i] + FONT_H, L.cx - x0, ex[i] + L.bpL, fn);

    // ── the tree's lines: the trunk from the card with a branch to each folder, and each open folder's own
    const trunkX = x0 + L.trunk;
    rect(g, trunkX, y0 + L.ch, 1, fy[2] + 2 - (y0 + L.ch) + 1, INK(1));
    for (let i = 0; i < 3; i++) {
      rect(g, trunkX + 1, fy[i] + 2, x0 + L.fx - trunkX - 1, 1, INK(1));
      if (ex[i] <= 0) continue;
      strip(i, () => {
        const sx = x0 + L.sx;
        rect(g, sx, fy[i] + FONT_H, 1, L.nL[i] * L.pitchL + 2 - FONT_H + 1, INK(1));
        for (let j = 0; j < L.nL[i]; j++) rect(g, sx + 1, fy[i] + (j + 1) * L.pitchL + 2, x0 + L.lx - sx - 1, 1, INK(1));
      });
    }

    // ── the stream: accent dashes from the card into the window
    const dl = row > 1 ? 3 : 2;
    const besideCard = wy < y0 + L.ch;
    for (let i = 0; i < N; i++) {
      const s = range(dashT(i), dashT(i) + STREAM_FLY, p);
      if (s <= 0 || s >= 1) continue;
      const e = easeInOut(s);
      let x: number;
      let y: number;
      if (vert) {
        // down the corridor, into the window's top
        const dx = cx + ((pw - dl) >> 1);
        const start: [number, number][] =
          x0 + L.cw > dx ? [[dx, y0 + L.ch]] : [[x0 + L.cw, y0 + 2], [dx, y0 + 2]];
        [x, y] = along([...start, [dx, wy - row]], e);
      } else {
        const sx = besideCard ? x0 + L.cw : Math.min(x0 + L.cw - 3, wx + 2);
        const sy = besideCard ? Math.max(y0 + 2, Math.min(rows[0], y0 + L.ch - 3)) : y0 + L.ch;
        x = Math.round(lerp(sx, textX, e));
        y = Math.round(lerp(sy, rows[dashRow(i)], e));
      }
      cut(g, x, y, dl, row);
      rect(g, x, y, dl, row, ACC(1));
    }

    // ── pages in flight (drawn before the rows, so they slide out from behind a file's bar,
    //    and kept off the window, so the note slides out from behind its border)
    /** where a page docks beside the window: above it (vertical), or level with text rows a…b */
    const dock = (a: number, b: number): [number, number] =>
      vert ? [cx, wy - ph - 1] : [cx, Math.round((rows[a] + rows[b] + row) / 2 - ph / 2)];
    const offWindow = (fn: () => void) => (vert ? clipped(g, 0, 0, r.w, wy, fn) : clipped(g, 0, 0, wx, r.h, fn));
    offWindow(() => {
      for (let v = 0; v < VISITS.length; v++) {
        const V = VISITS[v];
        const s =
          range(V.at + OUT, V.at + OUT + SLIDE_LEN, p) - range(V.at + BACK, V.at + BACK + SLIDE_LEN, p);
        if (s <= 0) continue;
        const [px, py] = tucked(L, fileRow(L, V.folder, V.leaf, fy[V.folder]));
        const [dx, dy] = dock(nI + 2 * v, nI + 2 * v + 1);
        const [x, y] = along([[px, py], [cx, py], [dx, dy]], easeInOut(s));
        page(g, x, y, pw, ph, V.steps, 11 + v);
      }
      // a copy of the memory note flies out of the window, along the corridor, into NOTES
      if (noteFly > 0 && noteFly < 1) {
        const [px, py] = tucked(L, fileRow(L, MEM, 0, fy[MEM]));
        const [dx, dy] = dock(noteRow, noteRow);
        const from: [number, number][] = vert ? [[cx, wy + 1]] : [[wx + 1, dy], [dx, dy]];
        const [x, y] = along([...from, [cx, py], [px, py]], easeInOut(noteFly));
        page(g, x, y, pw, ph, false, 17);
      }
    });

    // ── the rows: folders (selected = an ink bar), their files while expanded (lit = an accent bar)
    const glowIn = range(GLOW_IN[0], GLOW_IN[1], p);
    const glowOut = range(GLOW_OUT[0], GLOW_OUT[1], p);
    for (let i = 0; i < 3; i++) {
      const R = folderRow(L, i, fy[i]);
      let sel: [number, number] = [0, 0];
      for (const V of VISITS) {
        if (V.folder !== i) continue;
        sel = wipe(R, range(V.at, V.at + SEL, p), range(V.at + CLOSE, V.at + CLOSE + CLOSE_LEN, p));
      }
      if (i === MEM) sel = wipe(R, range(MEM_AT, MEM_AT + SEL, p), range(MEM_OFF[0], MEM_OFF[1], p));
      drawRow(g, R, INK(1), ex[i] > 0, L.bp > 0 ? INK(1) : null, sel[0], sel[1]);
      if (ex[i] <= 0) continue;
      strip(i, () => {
        for (let j = 0; j < L.nL[i]; j++) {
          const F = fileRow(L, i, j, fy[i]);
          let lit: [number, number] = [0, 0];
          for (const V of VISITS) {
            if (V.folder !== i || V.leaf !== j) continue;
            lit = wipe(F, range(V.at + LEAF_ON, V.at + LEAF_ON + 0.015, p), range(V.at + LEAF_OFF, V.at + LEAF_OFF + 0.015, p));
          }
          // NOTES: glows in from the right as the note arrives, fades back, keeps its name lit
          const notes = i === MEM && j === 0;
          if (notes && glowIn > 0 && glowOut < 1) {
            const [bx, , bw] = barBox(F);
            lit = [Math.max(bx + bw - Math.round(glowIn * bw), bx + Math.round(glowOut * bw)), bx + bw];
          }
          drawRow(g, F, notes && glowIn >= 1 ? ACC(1) : INK(1), false, ACC(1), lit[0], lit[1]);
        }
      });
    }

    r.commit();
  },
};

export default scene;
