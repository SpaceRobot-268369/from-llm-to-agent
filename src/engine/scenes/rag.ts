/**
 * rag — an open-book exam. A grid of document pages sits above the prompt
 * strip. A scan line sweeps across the grid (the search); three pages light up
 * in accent as it passes, then each slides down into the strip ahead of your
 * question, dissolving from a page into a run of text. The model only "knows"
 * what was pasted in.
 */
import { easeInOut, easeOut, lerp, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, space } from './helpers';
import { arrowDown, cells, cursor, docKit, erase, fillHeight, page, ragged, stripFrame, words } from './system';

const COLS = 4;
/** the pages the search finds, [column, row], in the order the scan reaches them */
const HITS: [number, number][] = [
  [0, 2],
  [1, 0],
  [3, 1],
];
const SCAN_A = 0.06;
const SCAN_B = 0.42;
/** pages are portrait: width ≤ this × height */
const ASPECT = 0.8;

/** The text on a page: fine 1-cell rows, as many as fit (≤ 4), centred below the fold. */
function pageText(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pt: number,
  ear: number,
  unit: number,
  seed: number,
  style: string,
) {
  const top0 = Math.round(y) + Math.max(pt + 1, Math.round(ear));
  const avail = Math.round(y + h) - pt - 1 - top0;
  const n = Math.min(4, Math.floor((avail + 1) / 2));
  if (n <= 0) return;
  const top = top0 + Math.floor((avail - (n * 2 - 1)) / 2);
  for (let i = 0; i < n; i++) {
    words(g, x + pt + 1, top + i * 2, w - pt * 2 - 2, 1, unit, seed * 7 + i, ragged(i, seed, 0.5), 1, style);
  }
}

const scene: Scene = {
  paint({ r, box, p, t, mobile }) {
    const g = r.begin();
    // --- layout: page grid on top, prompt strip below. Short (mobile) boxes
    // get two rows of pages, so each page stays tall enough to hold text; the
    // strip drops to 1-cell text when 2-cell text would squeeze the pages.
    const rows = mobile ? 2 : 3;
    const swMax = Math.round(Math.min(box.w * 0.86, space(box).L(1.1) * 2));
    const fit = (kit: ReturnType<typeof docKit>) => {
      const th = kit.row + 1;
      const sh = kit.T * 2 + kit.row * 2 + th;
      const drop = kit.row * 3 + 2;
      const gap = Math.max(2, kit.row);
      const cap = kit.T + 1; // the scan bar's top cap pokes above the grid
      const ph = Math.floor((fillHeight(box) - cap - sh - drop - (rows - 1) * gap) / rows);
      return { ...kit, th, sh, drop, gap, cap, ph };
    };
    let lay = fit(docKit(box));
    if (lay.row > 1 && lay.ph < 12) lay = fit(docKit(box, true));
    const { X, Y, T, row, unit, th, sh, drop, gap, cap, ph } = lay;
    const pt = Math.max(1, T - 1); // page outline: finer than the strip's
    // the scan bar travels gap + T beyond the grid and its caps reach row further
    const reach = gap + T + row;
    const pw = Math.min(Math.floor((swMax - 2 * reach - (COLS - 1) * gap) / COLS), Math.round(ph * ASPECT));
    const gw = COLS * pw + (COLS - 1) * gap;
    const sw = Math.min(swMax, gw + 2 * (row * 3 + T)); // a little wider than the grid
    const gh = rows * ph + (rows - 1) * gap;
    const gx = Math.round(X(0) - gw / 2);
    const gy = Math.round(Y(0) - (cap + gh + drop + sh) / 2 + cap);
    const sx = Math.round(X(0) - sw / 2);
    const sy = gy + gh + drop;
    const ear = Math.max(pt + 2, Math.round(pw * 0.26));

    // --- strip contents: [retrieved…] [<user> question] [cursor]
    const tx = sx + T + row + 1;
    const tw = sw - 2 * (T + row + 1);
    const ty = sy + T + row;
    const gapF = row + 1;
    const qW = Math.round(tw * 0.24);
    const fw = Math.floor((tw - qW - (row + 2) - HITS.length * gapF) / HITS.length);

    // --- story: sweep, light up, then fly into the strip
    const hits = HITS.map(([c, j]): [number, number] => [c, Math.min(j, rows - 1)]);
    const sweep = range(SCAN_A, SCAN_B, p);
    const beamX0 = gx - gap - T;
    const beamX1 = gx + gw + gap;
    const beamX = lerp(beamX0, beamX1, sweep);
    const settle = range(SCAN_B, SCAN_B + 0.08, p);
    const flight = HITS.map((_, n) => range(0.44 + n * 0.07, 0.62 + n * 0.07, p));
    const lit = hits.map(([c]) => {
      const hitAt = SCAN_A + ((gx + c * (pw + gap) + pw / 2 - beamX0) / (beamX1 - beamX0)) * (SCAN_B - SCAN_A);
      return easeOut(range(hitAt, hitAt + 0.035, p));
    });

    // the pages
    for (let j = 0; j < rows; j++) {
      for (let c = 0; c < COLS; c++) {
        const x = gx + c * (pw + gap);
        const y = gy + j * (ph + gap);
        const n = hits.findIndex(([hc, hr]) => hc === c && hr === j);
        const seed = 50 + j * COLS + c;
        let frame = INK(0.9 - 0.3 * settle);
        let text = INK(0.55 - 0.2 * settle);
        let fill: string | undefined;
        if (n >= 0 && lit[n] > 0) {
          const gone = flight[n] > 0;
          frame = ACC(gone ? 0.45 : lit[n]);
          text = ACC(gone ? 0.35 : 0.9 * lit[n]);
          if (!gone) fill = ACC(lit[n] * (0.2 + 0.05 * Math.sin(t * 3)));
        }
        page(g, x, y, pw, ph, pt, ear, frame, fill);
        pageText(g, x, y, pw, ph, pt, ear, unit, seed, text);
      }
    }

    // the scan line: a bar with a fading trail, capped top and bottom
    const beamA = 1 - range(SCAN_B, SCAN_B + 0.06, p);
    if (beamA > 0) {
      const bx = Math.round(beamX);
      const by = gy - 1;
      const bh = gh + 2;
      const trail = row * 3;
      for (let d = 1; d <= trail && sweep > 0; d++) cells(g, bx - d, by, 1, bh, INK(0.24 * (1 - d / (trail + 1)) * beamA));
      cells(g, bx, by, T, bh, INK(beamA));
      cells(g, bx - row, by - T, T + row * 2, T, INK(beamA));
      cells(g, bx - row, by + bh, T + row * 2, T, INK(beamA));
    }

    // the way in, then the strip: landed pages push the question right
    const slotsW = HITS.length * (fw + gapF) - gapF;
    arrowDown(g, tx + slotsW / 2, gy + gh + 1 + T, sy - 1, row + 1, INK(0.6), t * 4);
    stripFrame(g, sx, sy, sw, sh, T, INK(0.95));
    let shift = 0;
    for (let n = 0; n < HITS.length; n++) shift += (fw + gapF) * easeInOut(range(0.3, 0.85, flight[n]));
    const qx = Math.round(tx + shift);
    cells(g, qx, ty, unit + 1, th, INK(0.9));
    const qEnd = words(g, qx + unit + 2, ty, qW - unit - 2, th, unit, 13, 1, 1, INK(0.55));
    cursor(g, qEnd + 1, ty, th, t);

    // the retrieved pages: each pops up, then slides into its slot while it
    // shrinks and dissolves from a page into a run of text. Landed ones are
    // plain text in the strip; ones in flight float above the grid with a
    // clean margin (a second pass, after erasing beneath them).
    const flying: [number, number, number, number, number, number][] = [];
    for (let n = 0; n < HITS.length; n++) {
      const f = flight[n];
      if (f <= 0) continue;
      const [c, j] = hits[n];
      const pop = easeOut(range(0, 0.2, f)) * (1 - easeInOut(range(0.2, 1, f)));
      const go = easeInOut(range(0.2, 1, f));
      const x = Math.round(lerp(gx + c * (pw + gap), tx + n * (fw + gapF), go) + pop * row);
      const y = Math.round(lerp(gy + j * (ph + gap), ty, go) - pop * row);
      const w = Math.round(lerp(pw, fw, go));
      const h = Math.round(lerp(ph, th, go));
      if (f < 1) flying.push([x, y, w, h, n, range(0.45, 0.9, go)]);
      else words(g, x, y, w, h, unit, 50 + j * COLS + c, 1, 1, ACC(1));
    }
    r.commit();
    if (flying.length) {
      for (const [x, y, w, h] of flying) erase(r, x - 1, y - 1, w + 2, h + 2);
      const g2 = r.begin();
      for (const [x, y, w, h, n, m] of flying) {
        const [c, j] = hits[n];
        const seed = 50 + j * COLS + c;
        if (m < 1) {
          const k = h / ph;
          page(g2, x, y, w, h, pt, ear * Math.min(1, k + 0.3), ACC(1 - m), ACC(0.22 * (1 - m)));
          pageText(g2, x, y, w, h, pt, ear * k, unit, seed, ACC(0.9 * (1 - m)));
        }
        if (m > 0) words(g2, x, y + Math.round((h - th) / 2), w, th, unit, seed, 1, 1, ACC(m));
      }
      r.commit();
    }
  },
};

export default scene;
