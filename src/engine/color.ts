export type RGB = [number, number, number];

/**
 * The fixed vivid palette behind the Raster's `col` channel (slot k = VIVID[k - 1]).
 * Not tied to a section palette: it is for the few places where colour itself
 * is the meaning (the scaling brain lighting up). Saturated mid-dark hues
 * (blue, violet, magenta, crimson, burnt orange): each ≥ 2.1:1 against the
 * scaling green #5DCB8A, ≥ 3.4:1 against the paper backgrounds and ≥ 3:1
 * against the dark ink, so a coloured cell never reads as ink. Bright yellow
 * and orange are left out (≤ 1.6:1 on that green), and so is teal (too close
 * to the green's hue).
 */
export const VIVID = ['#2448F0', '#7A2CF0', '#C8157F', '#D61A3C', '#D9480F'] as const;

export function hex(h: string): RGB {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.replace(/(.)/g, '$1$1') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function css(c: RGB, alpha = 1): string {
  const [r, g, b] = c.map((v) => Math.round(v));
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(c: RGB): number {
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
