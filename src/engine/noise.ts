// Small, allocation-free noise helpers for per-cell work.

/** Integer hash → [0, 1). Stable for the same inputs. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 982451653;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1). */
export function vnoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Fractal value noise in [0, 1). `octaves` may be fractional. */
export function fbm(x: number, y: number, octaves: number, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  const whole = Math.floor(octaves);
  for (let i = 0; i <= whole; i++) {
    const w = i < whole ? 1 : octaves - whole;
    if (w <= 0) break;
    sum += vnoise(x * f, y * f, seed + i * 17) * amp * w;
    norm += amp * w;
    amp *= 0.5;
    f *= 2.03;
  }
  return norm > 0 ? sum / norm : 0;
}

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Map v from [a, b] to [0, 1], clamped. */
export const range = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
