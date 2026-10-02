/**
 * agentfiles — the map an agent reads first. On the left, a pixel file tree:
 * an index card (AGENTS.MD) with three folder tiles hanging off its trunk
 * (CONTEXT, MEMORY, SKILLS). On the right, the AGENT: a tall session window
 * that starts empty — nothing but a softly pulsing cursor.
 *
 * p (scene progress) tells the story:
 *   0    – 0.27  read first: the index card lights up in accent (a wipe), a
 *                short stream of accent lines flows from it into the window
 *                and types the first rows; then the card settles to an accent
 *                outline (it stays loaded) and the rows turn to ink.
 *   0.27 – 0.49  on demand, CONTEXT: the folder opens (inverts), a page
 *                (accent) slides out of it to the window's edge, the agent
 *                types what it read, and the page slides back; the folder
 *                closes again.
 *   0.47 – 0.69  the same for SKILLS: a page of steps (bullets) slides out,
 *                is read, and goes back.
 *   0.70 – 0.95  write back: the agent types a new line (accent) level with
 *                MEMORY; a copy flies straight out of the window into the
 *                folder (the line stays, in ink); the folder glows accent and
 *                fades back, keeping its label lit (it was updated).
 *   0.95 – 1     hold.
 * Unopened folders stay closed and dim: solid outline, a sparse fill.
 * t only pulses the cursor; everything reads at t = 0.
 *
 * The window's rows run in lanes: the index rows under its title bar, then
 * one group level with each folder (CONTEXT's rows · the MEMORY note ·
 * SKILLS' steps), so every page and the note travel straight across between
 * a folder and its own rows.
 *
 * Layout: whole cells, the largest kit that fits (cached per box size).
 * ROOMY (desktop side box): padded card and folders with tabs, 2-cell text
 * rows, an AGENT label over the window. MID (smaller desktops): tighter
 * padding, no label, the window level with the card. COMPACT (phones):
 * 1-cell rows (solid ink), folders without tabs. TINY / TINIER (short
 * phones): a solid card and the folders stacked on shared borders, the
 * smallest with no gap under the card and no margin. Pages travel in the gap between the folders and the window, so
 * nothing in flight covers another folder or the agent's rows.
 */
import { easeInOut, hash2, lerp, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, blink, pixelText, pixelTextWidth } from './helpers';

type G = CanvasRenderingContext2D;

const INDEX = 'AGENTS.MD';
const AGENT = 'AGENT';
const FOLDERS = ['CONTEXT', 'MEMORY', 'SKILLS'] as const;
const MEM = 1;
/** Pixel-font glyph height (cells). */
const FONT_H = 5;
/** Settled text rows: mid-tone ink, secondary to the outlines and labels (1-cell rows stay solid). */
const ROW_INK = 0.7;
/** Closed folders: a sparse fill. */
const DIM = 0.18;

// ── beats (scene progress) ──────────────────────────────────────────────
/** The index card lights up (wipe). */
const LIT: [number, number] = [0.03, 0.07];
/** The stream of lines: first dash leaves, spacing window, flight time. */
const STREAM0 = 0.07;
const STREAM_SPAN = 0.11;
const STREAM_FLY = 0.05;
/** The card settles to an outline, the index rows to ink. */
const SETTLE: [number, number] = [0.23, 0.27];
/** One on-demand visit: folder index, its rows' kind, and when each step starts. */
type Visit = { folder: number; steps: boolean; open: number; out: number; read: number; back: number; close: number };
const VISITS: Visit[] = [
  { folder: 0, steps: false, open: 0.27, out: 0.29, read: 0.35, back: 0.41, close: 0.46 },
  { folder: 2, steps: true, open: 0.47, out: 0.49, read: 0.55, back: 0.61, close: 0.66 },
];
const OPEN_LEN = 0.03;
const SLIDE_LEN = 0.06;
const READ_LEN = 0.055;
/** The new memory line: typed, then flown into MEMORY. */
const NOTE_TYPE: [number, number] = [0.7, 0.75];
const NOTE_FLY: [number, number] = [0.76, 0.85];
/** MEMORY glows accent (wipe in from the right), then fades back. */
const GLOW_IN: [number, number] = [0.84, 0.87];
const GLOW_OUT: [number, number] = [0.89, 0.95];

// ── kits ────────────────────────────────────────────────────────────────

type Kit = {
  /** a solid card (no outline: the tiny kit), its padding around the label, the dog-ear size */
  solid: boolean;
  cpx: number;
  cpy: number;
  ear: number;
  /** folder padding, tab height (0 = none) and tab width */
  tpx: number;
  tpy: number;
  tab: number;
  tabW: number;
  /** tiles' indent from the card's left edge, and the trunk's */
  indent: number;
  trunk: number;
  /** page size, and the gap it travels in (page width + clearance) */
  pw: number;
  ph: number;
  clear: number;
  /** text rows: height, pitch, extra space between groups; window title bar (solid rows) */
  row: number;
  pitch: number;
  group: number;
  bar: number;
  /** window width bounds */
  wwMin: number;
  wwMax: number;
  /** minimum gaps: under the card, between folders */
  g0: number;
  g: number;
  /** most extra cells a gap may take */
  gMax: number;
  /** index rows typed by the stream (at most; fewer when the lanes need the room), and its dashes */
  nIdx: number;
  dashes: number;
  /** cursor size */
  cur: [number, number];
  label: boolean;
  /** smallest margin (cells) when space is tight */
  m0: number;
};

const ROOMY: Kit = {
  solid: false,
  cpx: 2, cpy: 2, ear: 2,
  tpx: 2, tpy: 2, tab: 2, tabW: 10,
  indent: 5, trunk: 2,
  pw: 6, ph: 8, clear: 2,
  row: 2, pitch: 4, group: 2, bar: 3,
  wwMin: 13, wwMax: 17,
  g0: 3, g: 2, gMax: 3,
  nIdx: 3,
  dashes: 6,
  cur: [2, 2],
  label: true,
  m0: 1,
};

const COMPACT: Kit = {
  solid: false,
  cpx: 1, cpy: 1, ear: 1,
  tpx: 1, tpy: 1, tab: 0, tabW: 0,
  indent: 2, trunk: 0,
  pw: 4, ph: 5, clear: 1,
  row: 1, pitch: 2, group: 1, bar: 2,
  wwMin: 9, wwMax: 12,
  g0: 1, g: 1, gMax: 3,
  nIdx: 2,
  dashes: 4,
  cur: [2, 1],
  label: false,
  m0: 1,
};

/** Smaller desktop boxes: the roomy look with tighter padding and a smaller page. */
const MID: Kit = { ...ROOMY, cpx: 1, tpx: 1, tpy: 1, tabW: 8, indent: 4, pw: 5, ph: 7, pitch: 3, wwMin: 12 };

/** Short phones: a solid index card and the folders stacked, sharing their borders. */
const TINY: Kit = { ...COMPACT, solid: true, g: -1, gMax: 0, wwMin: 7 };
/** The smallest phones: the folders right under the card, no margin. */
const TINIER: Kit = { ...TINY, g0: 0, m0: 0 };

type Lay = Kit & {
  x0: number;
  y0: number;
  /** card size */
  cw: number;
  ch: number;
  /** folder: left, width, body height (with outline), body tops, label rows' middles */
  tx: number;
  tw: number;
  bh: number;
  ty: number[];
  mid: number[];
  wx: number;
  wy: number;
  ww: number;
  wh: number;
  /** top of the AGENT label, or -1 */
  labelY: number;
  textX: number;
  textW: number;
  /** text rows (top y): index…, context ×2, skills ×2, the memory note */
  rows: number[];
};

function fit(box: Box, k: Kit, force = false): Lay | null {
  const bx0 = Math.ceil(box.x);
  const bx1 = Math.floor(box.x + box.w);
  const by0 = Math.ceil(box.y);
  const by1 = Math.floor(box.y + box.h);
  const bw = bx1 - bx0;
  const bhh = by1 - by0;
  const edge = k.solid ? 0 : 2;
  const cw = pixelTextWidth(INDEX) + 2 * k.cpx + edge;
  const ch = FONT_H + 2 * k.cpy + edge;
  const tw = pixelTextWidth(FOLDERS[0]) + 2 * k.tpx + 2;
  const bh = FONT_H + 2 * k.tpy + 2;
  const tileH = k.tab + bh;

  // ── across: tree · gap for a page · window
  const left = k.indent + tw + k.pw + k.clear;
  let mx = Math.round(bw * 0.06);
  let ww = bw - 2 * mx - left;
  if (ww < k.wwMin) {
    mx = Math.max(k.m0, Math.floor((bw - left - k.wwMin) / 2));
    ww = bw - 2 * mx - left;
  }
  if (ww < k.wwMin && !force) return null;
  ww = Math.max(5, Math.min(ww, k.wwMax));
  const totalW = Math.max(cw, left + ww);
  const x0 = bx0 + Math.floor((bw - totalW) / 2);
  const wx = x0 + left;
  // the AGENT label sits over the window when it clears the card and the box
  const lw = pixelTextWidth(AGENT);
  const lx = Math.round(wx + ww / 2 - lw / 2);
  const label = k.label && lx >= x0 + cw + 1 && lx + lw <= bx1;

  // ── down: card · trunk gap · three folders
  const needH = ch + k.g0 + 3 * tileH + 2 * k.g;
  let my = Math.round(bhh * 0.07);
  let avail = bhh - 2 * my;
  if (avail < needH) {
    my = Math.max(k.m0, Math.floor((bhh - needH) / 2));
    avail = bhh - 2 * my;
  }
  if (avail < needH && !force) return null;
  const extra = Math.max(0, avail - needH);
  const add = Math.min(k.gMax, Math.floor(extra / 3));
  const g0 = k.g0 + add;
  const g = k.g + add;
  const H = needH + 3 * add;
  const y0 = by0 + my + Math.floor((avail - H) / 2);
  const ty: number[] = [];
  const mid: number[] = [];
  let y = y0 + ch + g0;
  for (let i = 0; i < 3; i++) {
    ty.push(y + k.tab);
    mid.push(y + k.tab + 1 + k.tpy + 2);
    y += tileH + g;
  }

  // ── the window: under its label; else level with the card when it clears it, or with the first folder
  const wy = label ? y0 + FONT_H + 2 : wx > x0 + cw ? y0 : ty[0] - k.tab;
  const wh = ty[2] + bh - wy;
  const r0 = wy + k.bar + (k.row > 1 ? 2 : 1);
  const lane = lanes(k, r0, ty, mid, bh, wy + wh - 2, force);
  if (!lane) return null;

  return {
    ...k,
    nIdx: lane.n,
    x0,
    y0,
    cw,
    ch,
    tx: x0 + k.indent,
    tw,
    bh,
    ty,
    mid,
    wx,
    wy,
    ww,
    wh,
    labelY: label ? y0 : -1,
    textX: wx + 2,
    textW: ww - 4,
    rows: lane.rows,
  };
}

/**
 * The window's text rows: the index rows under the title bar, then one lane
 * per folder, level with it (CONTEXT ×2 · the MEMORY note · SKILLS ×2), so a
 * page or the note travels straight across between a folder and its rows.
 * Drops index rows until every lane sits inside its folder's height.
 * Rows come back in paint order: index…, context ×2, skills ×2, the note.
 */
function lanes(k: Kit, r0: number, ty: number[], mid: number[], bh: number, end: number, force: boolean) {
  const size = [2, 1, 2];
  const span = (n: number) => (n - 1) * k.pitch + k.row;
  const sep = k.pitch + k.group;
  for (let n = k.nIdx; n >= 1; n--) {
    const top: number[] = [];
    let prev = r0 + (n - 1) * k.pitch;
    for (let f = 0; f < 3; f++) {
      top[f] = Math.max(Math.round(mid[f] + 0.5 - span(size[f]) / 2), prev + sep);
      prev = top[f] + (size[f] - 1) * k.pitch;
    }
    const level = top.every((y, f) => y >= ty[f] && y + span(size[f]) <= ty[f] + bh);
    if ((level && top[2] + span(2) <= end) || (force && n === 1)) {
      const rows: number[] = [];
      for (let i = 0; i < n; i++) rows.push(r0 + i * k.pitch);
      rows.push(top[0], top[0] + k.pitch, top[2], top[2] + k.pitch, top[1]);
      return { n, rows };
    }
  }
  return null;
}

const layCache = new Map<string, Lay>();
function layout(box: Box): Lay {
  const key = `${box.x.toFixed(1)}|${box.y.toFixed(1)}|${box.w.toFixed(1)}|${box.h.toFixed(1)}`;
  let L = layCache.get(key);
  if (L) return L;
  L = fit(box, ROOMY) ?? fit(box, MID) ?? fit(box, COMPACT) ?? fit(box, TINY) ?? fit(box, TINIER) ?? (fit(box, TINIER, true) as Lay);
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

/** Top-left of folder i's label (centred in the body). */
function folderLabel(L: Lay, i: number): [number, number] {
  return [L.tx + Math.floor((L.tw - pixelTextWidth(FOLDERS[i])) / 2), L.ty[i] + 1 + L.tpy];
}

/** One folder tile: closed (outline, sparse fill, solid label) or solid with the label knocked out. */
function folder(g: G, L: Lay, i: number, mode: 'closed' | 'solid', style: string) {
  const x = L.tx;
  const y = L.ty[i];
  const { tw, bh, tab, tabW } = L;
  const [lx, ly] = folderLabel(L, i);
  if (tab > 0) {
    rect(g, x + 1, y - tab, tabW - 2, 1, style);
    rect(g, x, y - tab + 1, tabW, tab - 1, style);
  }
  if (mode === 'solid') {
    rect(g, x, y, tw, bh, style);
    knock(g, FOLDERS[i], lx, ly);
    return;
  }
  rect(g, x, y, tw, 1, style);
  rect(g, x, y + bh - 1, tw, 1, style);
  rect(g, x, y + 1, 1, bh - 2, style);
  rect(g, x + tw - 1, y + 1, 1, bh - 2, style);
  // a sparse fill around (never inside) the label's box
  const lw = pixelTextWidth(FOLDERS[i]);
  const ix = x + 1;
  const iy = y + 1;
  const iw = tw - 2;
  const ih = bh - 2;
  const dim = INK(DIM);
  rect(g, ix, iy, iw, ly - iy, dim);
  rect(g, ix, ly + FONT_H, iw, iy + ih - (ly + FONT_H), dim);
  rect(g, ix, ly, lx - ix, FONT_H, dim);
  rect(g, lx + lw, ly, ix + iw - (lx + lw), FONT_H, dim);
  pixelText(g, FOLDERS[i], lx, ly, style);
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
  paint({ r, box, p, t }) {
    const g = r.begin();
    const L = layout(box);
    const { row, rows, textX, pw, ph } = L;
    const tileR = L.tx + L.tw - 1;
    const nI = L.nIdx;
    const noteRow = nI + 4;

    // ── the window: outline, title bar, label over it
    const { wx, wy, ww, wh } = L;
    rect(g, wx, wy, ww, L.bar, INK(1));
    rect(g, wx, wy + wh - 1, ww, 1, INK(1));
    rect(g, wx, wy + L.bar, 1, wh - L.bar - 1, INK(1));
    rect(g, wx + ww - 1, wy + L.bar, 1, wh - L.bar - 1, INK(1));
    if (L.labelY >= 0) pixelText(g, AGENT, wx + ww / 2, L.labelY, INK(1), { align: 'center' });

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
      const read = range(V.read, V.read + READ_LEN, p) * 2;
      const ink = range(V.close, V.close + 0.04, p);
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
    cut(g, L.x0, L.y0, L.cw, L.ch);
    if (settle > 0) {
      const xs = L.x0 + Math.round(settle * L.cw);
      clipped(g, L.x0, L.y0, xs - L.x0, L.ch, () => card(g, L, 'line', ACC(1)));
      clipped(g, xs, L.y0, L.x0 + L.cw - xs, L.ch, () => card(g, L, 'solid', ACC(1)));
    } else if (lit > 0) {
      const xs = L.x0 + Math.round(lit * L.cw);
      clipped(g, L.x0, L.y0, xs - L.x0, L.ch, () => card(g, L, 'solid', ACC(1)));
      clipped(g, xs, L.y0, L.x0 + L.cw - xs, L.ch, () => card(g, L, 'line', INK(1)));
    } else card(g, L, 'line', INK(1));

    // ── the tree: a trunk from the card, a branch to each folder
    const trunkX = L.x0 + L.trunk;
    rect(g, trunkX, L.y0 + L.ch, 1, L.mid[2] - (L.y0 + L.ch) + 1, INK(1));
    for (let i = 0; i < 3; i++) rect(g, trunkX + 1, L.mid[i], L.tx - trunkX - 1, 1, INK(1));

    // ── the stream: accent dashes from the card into the window
    const dl = row > 1 ? 3 : 2;
    const sx = wx > L.x0 + L.cw ? L.x0 + L.cw : Math.min(L.x0 + L.cw - 3, wx + 2);
    const sy = wx > L.x0 + L.cw ? Math.max(L.y0 + 2, Math.min(rows[0], L.y0 + L.ch - 3)) : L.y0 + L.ch;
    for (let i = 0; i < N; i++) {
      const s = range(dashT(i), dashT(i) + STREAM_FLY, p);
      if (s <= 0 || s >= 1) continue;
      const e = easeInOut(s);
      const x = Math.round(lerp(sx, textX, e));
      const y = Math.round(lerp(sy, rows[dashRow(i)], e));
      cut(g, x, y, dl, row);
      rect(g, x, y, dl, row, ACC(1));
    }

    // ── pages in flight (drawn before the folders, so they slide out from behind)
    for (let v = 0; v < VISITS.length; v++) {
      const V = VISITS[v];
      const s = range(V.out, V.out + SLIDE_LEN, p) - range(V.back, V.back + SLIDE_LEN, p);
      if (s <= 0) continue;
      // out of the folder first, then along the gap to its rows
      const x0 = tileR - pw;
      const y0 = L.mid[V.folder] - (ph >> 1);
      const x1 = tileR + 2;
      const r0 = rows[nI + 2 * v];
      const y1 = Math.round((r0 + rows[nI + 2 * v + 1] + row) / 2 - ph / 2);
      const hx = easeInOut(range(0, 0.55, s));
      const vy = easeInOut(range(0.45, 1, s));
      page(g, Math.round(lerp(x0, x1, hx)), Math.round(lerp(y0, y1, vy)), pw, ph, V.steps, 11 + v);
    }
    // a copy of the memory note flies straight across, out of the window into MEMORY
    if (noteFly > 0 && noteFly < 1) {
      const len = rowLen(L, noteRow, false);
      const x = Math.round(lerp(textX, tileR - len, easeInOut(noteFly)));
      const y = rows[noteRow];
      cut(g, x, y, len, row);
      rect(g, x, y, len, row, ACC(1));
    }

    // ── folders: closed, the one being read solid, MEMORY glowing
    const glowIn = range(GLOW_IN[0], GLOW_IN[1], p);
    const glowOut = range(GLOW_OUT[0], GLOW_OUT[1], p);
    for (let i = 0; i < 3; i++) {
      const x = L.tx;
      const y = L.ty[i] - L.tab;
      const h = L.tab + L.bh;
      cut(g, x, y, L.tw, h);
      const updated = i === MEM && glowIn >= 1;
      folder(g, L, i, 'closed', INK(1));
      if (updated) {
        // its label stays lit: the folder was updated
        const [lx, ly] = folderLabel(L, i);
        cut(g, lx, ly, pixelTextWidth(FOLDERS[i]), FONT_H);
        pixelText(g, FOLDERS[i], lx, ly, ACC(1));
      }
      // open (solid) while it is being read: wipes in, then out, left to right
      for (const V of VISITS) {
        if (V.folder !== i) continue;
        const a = x + Math.round(range(V.close, V.close + OPEN_LEN, p) * L.tw);
        const b = x + Math.round(range(V.open, V.open + OPEN_LEN, p) * L.tw);
        clipped(g, a, y, b - a, h, () => {
          cut(g, x, y, L.tw, h);
          folder(g, L, i, 'solid', INK(1));
        });
      }
      if (i === MEM && glowIn > 0 && glowOut < 1) {
        const a = Math.max(x + L.tw - Math.round(glowIn * L.tw), x + Math.round(glowOut * L.tw));
        clipped(g, a, y, x + L.tw - a, h, () => {
          cut(g, x, y, L.tw, h);
          folder(g, L, i, 'solid', ACC(1));
        });
      }
    }

    r.commit();
  },
};

export default scene;
