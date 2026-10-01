/**
 * The Pixel Field: one fixed full-screen canvas behind the page.
 *
 * Each frame it paints the current section's scene (and, while the next
 * section slides in, the next scene) into grid-resolution rasters, dissolves
 * them together in blocky pixel chunks, adds dust and a soft pointer halo, then
 * draws everything as quantized halftone squares.
 *
 * Section phases (see phases.ts) decide where each scene sits: beside the
 * text, or centred and enlarged in the WATCH phase; and how bright it is —
 * a dim ghost while the headline card owns the screen.
 */
import { useEffect, useRef } from 'react';
import { css } from './color';
import { drawHalftone } from './halftone';
import { hash2 } from './noise';
import { Raster } from './raster';
import { SCENES } from './scenes';
import { artRect, BASE_CELL_DESKTOP, BASE_CELL_MOBILE, grid, toGrid } from './layout';
import { placement } from './phases';
import { ticker, type Frame } from './ticker';

/** width of the dissolve front, in noise units */
const EDGE = 0.28;
/** soft, slow halo around the mouse — kept subtle so it never competes with reading */
const POINTER_RADIUS = 90; // CSS px
const POINTER_RATE = 3; // re-rolls per second
const POINTER_STRENGTH = 0.22;
export function PixelField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const A = new Raster();
    const B = new Raster();
    let values = new Float32Array(0);
    let accent = new Uint8Array(0);
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
        accent = new Uint8Array(n);
      }

      const common = { full, t: f.t, cell, mobile: f.mobile };
      const boxA = toGrid(artRect(W, H, f.mobile, pa.side, pa.focus), cell, offX, offY);
      A.clear();
      sa.paint({ r: A, box: boxA, p: pa.sp, ...common });
      if (blending) {
        const boxB = toGrid(artRect(W, H, f.mobile, pb!.side, pb!.focus), cell, offX, offY);
        B.clear();
        sb!.paint({ r: B, box: boxB, p: pb!.sp, ...common });
      }
      const la = pa.light;
      const lb = pb ? pb.light : 1;

      // combine: blocky dissolve from A to B
      const k = f.blend * (1 + EDGE);
      const ptr = f.pointer;
      const usePtr = ptr.on && !f.reduced && !f.mobile;
      const pcx = (ptr.x - offX) / cell;
      const pcy = (ptr.y - offY) / cell;
      const pr = POINTER_RADIUS / cell;
      const pr2 = pr * pr;
      const tick = Math.floor(f.clock * POINTER_RATE);
      const dustTick = Math.floor(f.t * 0.7);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const ai = A.ink[i];
          const aa = A.acc[i];
          let v = (ai > aa ? ai : aa) * la;
          let acc = aa > ai;
          if (blending) {
            const nz = 0.62 * hash2(x >> 2, y >> 2, 11) + 0.38 * hash2(x, y, 5);
            let w = (k - nz) / EDGE;
            w = w < 0 ? 0 : w > 1 ? 1 : w;
            if (w > 0) {
              const bi = B.ink[i];
              const ba = B.acc[i];
              const vb = (bi > ba ? bi : ba) * lb;
              v = v * (1 - w) + vb * w;
              if (w > 0.5) acc = ba > bi;
            }
          }
          // dust: sparse print speckle across the whole field
          const dz = hash2(x, y, 97);
          if (dz > 0.991) {
            const d = hash2(x, y, 131 + dustTick) > 0.4 ? 0.3 : 0.12;
            if (d > v) {
              v = d;
              acc = false;
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
          accent[i] = acc ? 1 : 0;
        }
      }

      ctx.fillStyle = css(f.colors.bg);
      ctx.fillRect(0, 0, cw, ch);
      drawHalftone({
        ctx,
        values,
        accent,
        w: cols,
        h: rows,
        cell: cell * dpr,
        offX: offX * dpr,
        offY: offY * dpr,
        inkColor: css(f.colors.px),
        accColor: css(f.colors.accent),
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
