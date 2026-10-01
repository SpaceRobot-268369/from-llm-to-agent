/**
 * scaling — the model gets bigger as you scroll.
 *
 * An organic halftone mass (a "brain") grows in size, and the grid itself gets
 * finer: cell size shrinks from ~30px to ~6px. More cells = more parameters =
 * a more detailed picture of the same thing. In the closing question phase the
 * mass drifts to the centre and erodes into fog.
 */
import { SCALING } from '../../content/sections';
import { clamp, easeInOut, easeOut, fbm, hash2, lerp, range, smoothstep } from '../noise';
import type { Scene } from './types';
import { field } from './helpers';

const { growStart, growEnd, questionStart } = SCALING.phases;

// ── precomputed noise textures over brain space n ∈ [-R, R]² ──────────────
// fbm per cell was ~10 ms/frame at full size; bilinear lookups are ~20× cheaper.
const R = 1.4;
const N = 192;
let WOBBLE: Float32Array | null = null;
let FOLD_LO: Float32Array | null = null;
let FOLD_HI: Float32Array | null = null;

function bake(octaves: number, freq: number, ox: number, oy: number, seed: number): Float32Array {
  const out = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const ny = (j / (N - 1)) * 2 * R - R;
    for (let i = 0; i < N; i++) {
      const nx = (i / (N - 1)) * 2 * R - R;
      out[j * N + i] = fbm(nx * freq + ox, ny * freq + oy, octaves, seed);
    }
  }
  return out;
}

function sample(tex: Float32Array, nx: number, ny: number): number {
  const fx = clamp((nx + R) / (2 * R)) * (N - 1);
  const fy = clamp((ny + R) / (2 * R)) * (N - 1);
  const x0 = fx | 0;
  const y0 = fy | 0;
  const x1 = x0 < N - 1 ? x0 + 1 : x0;
  const y1 = y0 < N - 1 ? y0 + 1 : y0;
  const tx = fx - x0;
  const ty = fy - y0;
  const a = tex[y0 * N + x0];
  const b = tex[y0 * N + x1];
  const c = tex[y1 * N + x0];
  const d = tex[y1 * N + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** growth 0..1 across the milestones */
export const growth = (p: number) => range(growStart, growEnd, p);

const scene: Scene = {
  cell(p, base) {
    // 30px → 6px on desktop (base 9); proportionally on mobile
    const coarse = base * 3.3;
    const fine = base * 0.67;
    return coarse * Math.pow(fine / coarse, easeInOut(growth(p)));
  },

  paint({ r, box, full, p, t }) {
    const s = growth(p);
    const q = easeInOut(range(questionStart, 1, p));
    const radius = (box.s / 2) * (0.2 + 0.78 * easeOut(s)) * (1 + 0.25 * q);
    const cx = lerp(box.cx, full.cx, q);
    const cy = lerp(box.cy, full.cy, q);
    if (!WOBBLE) {
      WOBBLE = bake(2, 1.3, 4.1, 0, 7);
      FOLD_LO = bake(1, 2.2, 0, 0, 3);
      FOLD_HI = bake(4, 2.2, 0, 0, 3);
    }
    const wob = WOBBLE;
    const lo = FOLD_LO!;
    const hi = FOLD_HI!;
    const detail = easeInOut(s);
    const breathe = 1 + 0.012 * Math.sin(t * 0.7);
    const fissure = smoothstep(0.25, 0.6, s);
    const erode = q;
    const tick = Math.floor(t * 9);

    // brain-local coordinates: |n| ≈ 1 at the rim; the boundary wobbles to ≤ 1.28
    const rx = radius * 1.3;
    const ry = radius * 0.8 * 1.3;
    const area = { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2, cx, cy, s: ry * 2 };
    field(r, area, (u, v, x, y) => {
      const nx = ((u - 0.5) * 2 * rx) / radius / breathe;
      const ny = ((v - 0.5) * 2 * ry) / (radius * 0.8) / breathe;
      const d = Math.hypot(nx, ny);
      if (d > 1.3) return 0;
      const wobble = 1 + 0.55 * (sample(wob, nx, ny) - 0.5);
      const inside = smoothstep(wobble, wobble - 0.32, d);
      if (inside <= 0) return 0;
      // folds (gyri): banded noise that gains octaves as the model grows
      const nl = sample(lo, nx, ny);
      const n = nl + (sample(hi, nx, ny) - nl) * detail;
      const folds = 0.5 + 0.5 * Math.sin(n * 13 + nx * 1.5);
      // centre fissure between hemispheres
      const gap = 1 - fissure * (1 - smoothstep(0.03, 0.11, Math.abs(nx + 0.1 * ny)));
      // shading: denser toward the lower-left, like ink pooling
      const shade = 0.82 + 0.25 * clamp(0.5 - 0.35 * nx + 0.3 * ny);
      let val = inside * gap * shade * (0.4 + 0.66 * Math.pow(folds, 1.25));
      // question phase: erode into fog
      if (erode > 0) {
        const keep = hash2(x, y, 41);
        val *= keep > erode * 0.85 ? 1 - erode * 0.55 : 0.12;
      }
      return val;
    });

    // neurons firing: accent sparkles inside the mass
    if (s > 0.05 && erode < 0.9) {
      const rate = 0.004 + 0.012 * s;
      field(
        r,
        area,
        (u, v, x, y) => {
          const nx = ((u - 0.5) * 2 * rx) / radius;
          const ny = ((v - 0.5) * 2 * ry) / (radius * 0.8);
          if (nx * nx + ny * ny > 0.75) return 0;
          return hash2(x, y, tick) < rate ? 1 - erode : 0;
        },
        true,
      );
    }
  },
};

export default scene;
