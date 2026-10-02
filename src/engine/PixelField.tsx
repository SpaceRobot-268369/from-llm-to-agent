/**
 * The Pixel Field: one fixed full-screen canvas behind the page.
 *
 * Each frame it paints the current section's scene (and, while the next
 * section slides in, the next scene) into grid-resolution rasters, clips each
 * to its art box (so diagrams never overlap text), blends them — a blocky
 * dissolve between topics, a directional wipe between chapters — adds dust and
 * a soft pointer halo, then draws quantized halftone marks in the chapter's
 * mark shape (squares / dashes / crosses).
 *
 * Section phases (see phases.ts) decide where each scene sits (beside the
 * text, or centred in a WATCH act) and how visible it is (nothing while a
 * headline card is up).
 */
import { useEffect, useRef } from 'react';
import { css, VIVID } from './color';
import { heroHole } from './layout';
import { drawHalftone, MARK, TONE_ACC, TONE_INK, TONE_VIVID } from './halftone';
import { chapterOf, type Section } from '../content/sections';
import type { Box } from './scenes/types';
import { hash2, smoothstep } from './noise';
import { Raster } from './raster';
import { SCENES } from './scenes';
import { artRect, BASE_CELL_DESKTOP, BASE_CELL_MOBILE, grid, toGrid } from './layout';
import { placement } from './phases';
import { ticker, type Frame } from './ticker';
import { EDGE, wipeFront } from './wipe';
/** soft, slow halo around the mouse — kept subtle so it never competes with reading */
const POINTER_RADIUS = 90; // CSS px
const POINTER_RATE = 3; // re-rolls per second
const POINTER_STRENGTH = 0.22;
/** cells of slack around the art box before clipping */
const CLIP_MARGIN = 1;

function markOf(s: Section): number {
  return MARK[chapterOf(s)?.mark ?? 'square'];
}

/** a cell's halftone tone: accent if it wins, else ink — in its vivid colour when tagged (Raster.col) */
function toneOf(ink: number, acc: number, col: number): number {
  if (acc > ink) return TONE_ACC;
  return col && ink > 0 ? TONE_VIVID + col - 1 : TONE_INK;
}

/** css colours per halftone tone: [ink, accent, ...VIVID]; the first two follow the palette each frame */
const TONE_COLORS: string[] = ['', '', ...VIVID];

/** Clip a raster to a box (+margin) in place. */
function clip(r: Raster, b: Box) {
  const x0 = Math.floor(b.x) - CLIP_MARGIN;
  const y0 = Math.floor(b.y) - CLIP_MARGIN;
  const x1 = Math.ceil(b.x + b.w) + CLIP_MARGIN;
  const y1 = Math.ceil(b.y + b.h) + CLIP_MARGIN;
  for (let y = 0; y < r.h; y++) {
    const inY = y >= y0 && y < y1;
    const row = y * r.w;
    for (let x = 0; x < r.w; x++) {
      if (inY && x >= x0 && x < x1) continue;
      r.ink[row + x] = 0;
      r.acc[row + x] = 0;
      r.col[row + x] = 0;
    }
  }
}

/** [x0, x1, y0, y1] in cells where the current section's text sits (dust-free). */
function textZone(pl: ReturnType<typeof placement>, cols: number, rows: number): [number, number, number, number] | null {
  const s = pl.sec;
  if (s.kind === 'hero') {
    return [heroHole.x * cols, (heroHole.x + heroHole.w) * cols, heroHole.y * rows, (heroHole.y + heroHole.h) * rows];
  }
  if (s.kind === 'part') return [cols * 0.12, cols * 0.9, rows * 0.15, rows * 0.85];
  if (pl.light < 0.5) return [cols * 0.12, cols * 0.88, rows * 0.18, rows * 0.82]; // headline card
  if (pl.focus > 0.5) return [cols * 0.18, cols * 0.82, rows * 0.8, rows]; // watch captions
  return pl.side === 'left' ? [cols * 0.5, cols, 0, rows] : [0, cols * 0.5, 0, rows];
}

export function PixelField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const A = new Raster();
    const B = new Raster();
    let values = new Float32Array(0);
    let tones = new Uint8Array(0);
    let marks = new Uint8Array(0);
    // draw at the canvas's own CSS size — innerWidth includes a classic
    // scrollbar, which would make the browser resample (blur) the squares
    let W = canvas.clientWidth;
    let H = canvas.clientHeight;
    const ro = new ResizeObserver(() => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
    });
    ro.observe(canvas);

    const render = (f: Frame) => {
      if (!W || !H) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.round(W * dpr);
      const ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      const base = f.mobile ? BASE_CELL_MOBILE : BASE_CELL_DESKTOP;
      const pa = placement(f.cur, f.p, f);
      const pb = f.next >= 0 ? placement(f.next, 0, f) : null;
      const sa = SCENES[pa.sec.scene];
      const sb = pb ? SCENES[pb.sec.scene] : null;
      const blending = !!sb && f.blend > 0.001;
      const ca = sa.cell ? sa.cell(pa.sp, base) : base;
      const cb = sb ? (sb.cell ? sb.cell(pb!.sp, base) : base) : ca;
      const cell = blending ? ca + (cb - ca) * f.blend : ca;

      const { cols, rows, offX, offY, full } = grid(W, H, cell);
      A.resize(cols, rows);
      if (blending) B.resize(cols, rows);
      const n = cols * rows;
      if (values.length !== n) {
        values = new Float32Array(n);
        tones = new Uint8Array(n);
        marks = new Uint8Array(n);
      }

      const common = { full, t: f.t, cell, mobile: f.mobile };
      const boxA = toGrid(artRect(W, H, f.mobile, pa.side, pa.focus), cell, offX, offY);
      A.clear();
      if (pa.light > 0.001) {
        sa.paint({ r: A, box: boxA, p: pa.sp, ...common });
        if (!sa.unclipped?.(pa.sp)) clip(A, boxA);
      }
      if (blending) {
        const boxB = toGrid(artRect(W, H, f.mobile, pb!.side, pb!.focus), cell, offX, offY);
        B.clear();
        if (pb!.light > 0.001) {
          sb!.paint({ r: B, box: boxB, p: pb!.sp, ...common });
          if (!sb!.unclipped?.(pb!.sp)) clip(B, boxB);
        }
      }
      // the incoming section opens on its headline (no diagram yet): clear the
      // outgoing diagram before that headline rises into view (~blend 0.5), so
      // dissolve / wipe leftovers never sit behind its text
      const lb = pb ? pb.light : 1;
      const clearOut = blending && lb < 0.01 ? 1 - smoothstep(0.28, 0.5, f.blend) : 1;
      const la = pa.light * clearOut;
      const markA = markOf(pa.sec);
      const markB = pb ? markOf(pb.sec) : markA;
      // a chapter change wipes left → right; a topic change dissolves in blocks
      const wipe = !!pb && pa.sec.chapter !== pb.sec.chapter;

      // combine
      const k = f.blend * (1 + EDGE);
      const ptr = f.pointer;
      const usePtr = ptr.on && !f.reduced && !f.mobile;
      const pcx = (ptr.x - offX) / cell;
      const pcy = (ptr.y - offY) / cell;
      const pr = POINTER_RADIUS / cell;
      const pr2 = pr * pr;
      const tick = Math.floor(f.clock * POINTER_RATE);
      // where page text sits right now: dust there reads like stray punctuation
      const quiet = f.mobile ? null : textZone(pa, cols, rows);
      const dustTick = Math.floor(f.t * 0.7);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const ai = A.ink[i];
          const aa = A.acc[i];
          let v = (ai > aa ? ai : aa) * la;
          let tone = toneOf(ai, aa, A.col[i]);
          let mark = markA;
          if (blending) {
            const nz = wipe
              ? 0.82 * (x / cols) + 0.18 * hash2(x >> 1, y >> 1, 23)
              : 0.62 * hash2(x >> 2, y >> 2, 11) + 0.38 * hash2(x, y, 5);
            let w = (k - nz) / EDGE;
            w = w < 0 ? 0 : w > 1 ? 1 : w;
            if (w > 0) {
              const bi = B.ink[i];
              const ba = B.acc[i];
              const vb = (bi > ba ? bi : ba) * lb;
              v = v * (1 - w) + vb * w;
              if (w > 0.5) {
                tone = toneOf(bi, ba, B.col[i]);
                mark = markB;
              }
            }
          }
          // dust: sparse print speckle across the whole field
          const dz = hash2(x, y, 97);
          if (dz > 0.991 && !(quiet && x >= quiet[0] && x < quiet[1] && y >= quiet[2] && y < quiet[3])) {
            const d = hash2(x, y, 131 + dustTick) > 0.4 ? 0.3 : 0.12;
            if (d > v) {
              v = d;
              tone = TONE_INK;
            }
          }
          if (usePtr) {
            const dx = x - pcx;
            const dy = y - pcy;
            const d2 = dx * dx + dy * dy;
            if (d2 < pr2) {
              const fall = 1 - Math.sqrt(d2) / pr;
              if (hash2(x, y, tick) < fall * POINTER_STRENGTH) v = v > 0.5 ? v * 0.7 : v + fall * 0.3;
            }
          }
          values[i] = v;
          tones[i] = tone;
          marks[i] = mark;
        }
      }

      if (wipe && blending) {
        // the new chapter's colour sweeps in behind the wipe front
        ctx.fillStyle = pa.sec.palette.bg;
        ctx.fillRect(0, 0, cw, ch);
        const front = wipeFront(f.blend);
        ctx.fillStyle = pb!.sec.palette.bg;
        ctx.fillRect(0, 0, Math.round(front * cw), ch);
      } else {
        ctx.fillStyle = css(f.colors.bg);
        ctx.fillRect(0, 0, cw, ch);
      }
      TONE_COLORS[TONE_INK] = css(f.colors.px);
      TONE_COLORS[TONE_ACC] = css(f.colors.accent);
      drawHalftone({
        ctx,
        values,
        tones,
        marks,
        w: cols,
        h: rows,
        cell: cell * dpr,
        offX: offX * dpr,
        offY: offY * dpr,
        colors: TONE_COLORS,
      });
    };

    const off = ticker.onFrame(render);
    return () => {
      off();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="pixel-field" aria-hidden="true" />;
}
