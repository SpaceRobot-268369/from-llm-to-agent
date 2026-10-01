/**
 * skill — a folder of know-how, loaded on demand. Five thin folder bars
 * (descriptions only: a name chip and one line) sit in a stack. A pointer
 * scans down them; one matches, turns accent, and opens into a full SKILL.md
 * — numbered steps typing in, plus the scripts and templates it carries —
 * while the other four shrink to slivers (progressive disclosure).
 */
import { clamp, easeInOut, hash2, lerp, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, blink, fillRound, space, strokeRound, textLines } from './helpers';

const COUNT = 5;
const MATCH = 2;

const easeOutBack = (x: number) => (x <= 0 ? 0 : 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2);

type G = CanvasRenderingContext2D;

/** Family card: outlined window with a solid title bar and text rows. */
function card(g: G, x0: number, y0: number, w: number, h: number, rad: number, lw: number, seed: number, style: string, rowStyle: string) {
  const bar = Math.max(2, Math.round(h * 0.26));
  strokeRound(g, x0, y0, w, h, rad, lw, style);
  fillRound(g, x0, y0, w, bar, rad, style);
  const n = Math.max(0, Math.floor((h - bar - 2 + 1) / 3));
  textLines(g, x0 + 2, y0 + bar + 1.5, w - 4, n, 2, 1, rowStyle, seed);
}

/** Nearest odd whole number (so a 2-row text line centres on whole cells). */
const odd = (x: number) => 2 * Math.round((x - 1) / 2) + 1;

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { L } = space(box);
    // family vocabulary: one primary stroke, one card radius, 2-cell text rows
    const lw = Math.max(1.5, L(0.045));
    const rad = L(0.06);

    const scan = easeInOut(range(0.04, 0.2, p)) * MATCH; // pointer walks down
    const lit = range(0.2, 0.26, p); // the match turns accent
    const open = easeInOut(range(0.26, 0.58, p)); // …and opens up
    const typed = range(0.36, 0.7, p); // steps load in
    const extras = easeOutBack(range(0.58, 0.74, p)); // bundled files
    // ink → accent without a density dip halfway
    const inkK = clamp(2 - 2 * lit);
    const accK = clamp(2 * lit);

    // frame: a stack no wider than a page, centred in the box
    const my = box.h * 0.07;
    const top = box.y + my;
    const H = box.h - 2 * my;
    const ptrW = Math.max(3, Math.round(L(0.12)));
    const bw = Math.round(Math.min(box.w * 0.86 - ptrW - 2, H * 1.15));
    const x0 = Math.round(box.cx - (bw - ptrW - 2) / 2) + 0.5;
    const tabW = Math.round(bw * 0.22);

    // stack metrics: collapsed bars, squeezed bars, and the opened document
    const tab0 = 2;
    const fit = Math.floor((H - (COUNT - 1) * 1.5) / COUNT - tab0);
    const bh0 = Math.max(5, Math.min(odd(L(0.2)), fit % 2 ? fit : fit - 1));
    const gap0 = clamp((H - COUNT * (bh0 + tab0)) / (COUNT - 1), 1, L(0.11));
    const bhC = 3;
    const tabC = 1;
    const gapC = Math.max(1, L(0.04));
    const docSlot = H - (COUNT - 1) * (bhC + tabC + gapC);

    const slot: number[] = [];
    let total = 0;
    for (let i = 0; i < COUNT; i++) {
      slot[i] = i === MATCH ? lerp(bh0 + tab0, docSlot, open) : lerp(bh0 + tab0, bhC + tabC, open);
      total += slot[i];
    }
    const gap = lerp(gap0, gapC, open);
    total += gap * (COUNT - 1);

    const chipW = Math.round(bw * 0.17);
    let y = top + (H - total) / 2;
    const midY: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      const isDoc = i === MATCH;
      const tab = isDoc ? tab0 : lerp(tab0, tabC, open);
      const by = Math.round(y + tab) + 0.5; // body top stroke, on a cell centre
      const bh = Math.max(2, Math.round(y + slot[i]) - 0.5 - by);
      const tx = x0 + Math.round((bw - tabW) * (i / (COUNT - 1)));
      // the tab sits on the top stroke (never inside the body)
      const tabTop = by - tab - 0.5;
      const tabPath = () => {
        g.beginPath();
        g.roundRect(tx, tabTop, tabW, by - tabTop, [Math.min(rad * 0.6, tab), Math.min(rad * 0.6, tab), 0, 0]);
      };
      // the name/description row, centred in a collapsed bar (whole cells)
      const rowY = by - 0.5 + (bh0 - 1) / 2;
      midY[i] = rowY + 1;
      const descX = x0 + 2.5 + chipW + 2;
      const descW = (bw - chipW - 7) * (0.5 + 0.4 * hash2(i, 3, 5));

      if (!isDoc) {
        // a folder bar: tab + outlined body, a name chip and a one-line description
        const near = Math.max(0, 1 - Math.abs(scan - i) * 1.6) * (1 - lit);
        const a = lerp(0.62 + 0.38 * near, 0.4, open);
        tabPath();
        g.fillStyle = INK(a);
        g.fill();
        strokeRound(g, x0, by, bw, bh, rad, lw, INK(a));
        const inner = 1 - range(0, 0.5, open);
        if (inner > 0) {
          fillRound(g, x0 + 2.5, rowY, chipW, 2, 0.5, INK(a * inner));
          fillRound(g, descX, rowY, descW, 2, 1, INK((0.38 + 0.3 * near) * inner));
        }
      } else {
        // the match: an ordinary bar until the pointer reaches it, then
        // ink → accent, then opening into SKILL.md
        const near = Math.max(0, 1 - Math.abs(scan - i) * 1.6);
        const a = (0.62 + 0.38 * near) * inkK;
        tabPath();
        g.fillStyle = INK(a);
        g.fill();
        g.fillStyle = ACC(accK);
        g.fill();
        strokeRound(g, x0, by, bw, bh, rad, lw, INK(a));
        strokeRound(g, x0, by, bw, bh, rad, lw, ACC(accK));
        fillRound(g, x0 + 2.5, rowY, chipW, 2, 0.5, INK(a));
        fillRound(g, x0 + 2.5, rowY, chipW, 2, 0.5, ACC(accK));
        fillRound(g, descX, rowY, descW, 2, 1, INK((0.38 + 0.3 * near) * inkK));
        fillRound(g, descX, rowY, descW, 2, 1, ACC(0.55 * accK));

        if (open > 0) {
          g.save();
          g.beginPath();
          g.rect(x0, by, bw, bh - 1);
          g.clip();
          const bottom = by + docSlot - tab0; // the fully open doc's bottom stroke
          const rowsTop = rowY + 5;
          // the bundled files (template, script) stand in a column on the
          // right when there's room; the steps fill the rest of the page
          const fh = Math.round(clamp(L(0.28), 8, 12));
          const fw = Math.round(fh * 0.9);
          const files = bottom - 2 - rowsTop >= 2 * fh + 3 && bw >= fw + 30;
          const textW = bw - 12 - (files ? fw + 4 : 0);
          const n = Math.min(12, Math.max(1, Math.floor((bottom - 1 - rowsTop) / 3)));
          // divider under the header
          g.fillStyle = INK(0.45);
          g.fillRect(x0 + 2.5, rowY + 3, bw - 5, 1);
          // numbered steps: a bullet and a ragged line each, typed in order
          const shown = typed * n;
          const textX = x0 + 7.5;
          for (let k = 0; k < n; k++) {
            const ry = rowsTop + k * 3;
            const part = clamp(shown - k);
            // bullets on whole cells (plain rects stay crisp)
            g.fillStyle = ACC(part > 0 ? 1 : 0.25);
            g.fillRect(x0 + 3.5, ry, 2, 2);
            if (part <= 0) continue;
            const lwid = textW * (0.5 + 0.5 * hash2(k, 7, 9)) * part;
            fillRound(g, textX, ry, lwid, 2, 1, INK(0.6));
            if (part < 1 && blink(t)) {
              g.fillStyle = INK(1);
              g.fillRect(Math.ceil(textX + lwid) + 1, ry - 0.5, 1, 3);
            }
          }
          if (files && extras > 0) {
            const fx = x0 + bw - 4 - fw;
            for (let f = 0; f < 2; f++) {
              const s = clamp(extras * 1.2 - f * 0.2);
              if (s <= 0) continue;
              const w = Math.max(1, Math.round(fw * s));
              const h = Math.max(1, Math.round(fh * s));
              const cx0 = fx + Math.round((fw - w) / 2);
              const cy0 = rowsTop + 0.5 + f * (fh + 3) + Math.round((fh - h) / 2);
              card(g, cx0, cy0, w, h, rad * 0.7, lw * 0.85, 21 + f, INK(0.9), INK(0.5));
            }
          }
          g.restore();
        }
      }
      y += slot[i] + gap;
    }

    // the pointer: a task looking for the right skill
    const pi = Math.min(MATCH, scan);
    const lo = Math.floor(pi);
    const hi = Math.min(COUNT - 1, lo + 1);
    const py = lerp(midY[lo], midY[hi], pi - lo);
    const px = x0 - 2.5 - ptrW + 0.8 * Math.sin(t * 3.2) * (1 - open);
    const ph = ptrW * 1.15;
    g.beginPath();
    g.moveTo(px, py - ph / 2);
    g.lineTo(px + ptrW, py);
    g.lineTo(px, py + ph / 2);
    g.closePath();
    g.fillStyle = INK(1);
    g.fill();

    r.commit();
  },
};

export default scene;
