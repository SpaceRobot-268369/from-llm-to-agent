/**
 * Is a click on empty space? True only where the visitor sees the bare
 * Pixel Field: not on text, not on anything interactive or framed (buttons,
 * links, code, figures), not on the HUD, and not where an opaque panel covers
 * the canvas (the copy panels on phones).
 *
 * Hit testing alone can't answer that, so a Page snapshot (one per click)
 * fills two gaps:
 *   - Copy the visitor can't see — a faded-out read column (opacity 0) — is
 *     still hit-testable: the test looks through anything effectively
 *     transparent.
 *   - Copy the pointer passes through (pointer-events: none: headline cards,
 *     WATCH captions, the scaling question) and the HUD's fixed bands (pseudo-
 *     elements, like the bottom band on phones) never come back from hit
 *     testing: the snapshot collects their rects.
 */

/** never pop on these, or inside them */
const SOLID = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  'details',
  '[role="button"]',
  '[role="link"]',
  '[contenteditable]',
  '[tabindex]',
  'pre',
  'code',
  'figure',
  'svg',
  'img',
  'video',
  '.loader',
].join(',');

/** the fixed chrome: pops stay off it and its bands */
export const HUD = '.topbar, .rail, .trail, .totop';

/** content layers the pointer passes through (pointer-events: none): hit testing can't see their copy */
const VEILS = '.card, .watch, .scaling__question';

/** below this effective opacity, content is out of sight: look through it */
const SEEN = 0.05;
/** slack (CSS px) around a character or a veiled line of copy */
const PAD = 3;

export type Rect = { left: number; top: number; right: number; bottom: number };

const inside = (r: Rect, x: number, y: number, pad = 0) =>
  x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

/** a computed background colour that hides the canvas */
function opaque(c: string): boolean {
  if (c === 'transparent') return false;
  const m = /\/\s*([\d.]+)(%?)\s*\)$/.exec(c) ?? /^rgba\(.*,\s*([\d.]+)(%?)\s*\)$/.exec(c);
  if (!m) return true; // no alpha: fully opaque
  const a = parseFloat(m[1]) / (m[2] ? 100 : 1);
  return a > 0.3;
}

/** the caret position nearest (x, y), across engines */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/**
 * The page as it covers the canvas right now. Take one per click: it caches
 * styles, so probing a pop's whole footprint stays cheap.
 */
export class Page {
  /** fixed chrome rects, including its fixed pseudo-element bands */
  readonly hud: Rect[] = [];
  /** copy and panels in pointer-transparent layers */
  private veils: Rect[] = [];
  private alpha = new Map<Element, number>();
  private covered = new Map<Element, boolean>();
  private range = document.createRange();

  constructor() {
    for (const el of document.querySelectorAll(HUD)) {
      if (this.opacity(el) < SEEN) continue;
      this.hud.push(el.getBoundingClientRect());
      // a fixed band drawn by a pseudo-element (the bottom band behind the trail on phones)
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content === 'none' || ps.display === 'none' || ps.position !== 'fixed') continue;
        const left = parseFloat(ps.left);
        const top = parseFloat(ps.top);
        const w = parseFloat(ps.width);
        const h = parseFloat(ps.height);
        if ([left, top, w, h].every(Number.isFinite)) this.hud.push({ left, top, right: left + w, bottom: top + h });
      }
    }
    for (const layer of document.querySelectorAll(VEILS)) {
      if (this.opacity(layer) >= SEEN) this.veil(layer);
    }
  }

  /** the rects a pointer-transparent layer covers: its opaque panels and every line of its copy */
  private veil(el: Element) {
    if (this.opacity(el) < SEEN) return;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== 'none' || opaque(cs.backgroundColor)) {
      this.veils.push(el.getBoundingClientRect());
      return;
    }
    for (const n of el.childNodes) {
      if (n.nodeType === Node.ELEMENT_NODE) this.veil(n as Element);
      else if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
        this.range.selectNodeContents(n);
        for (const r of this.range.getClientRects()) this.veils.push(r);
      }
    }
  }

  /** effective opacity: the element's own times every ancestor's (0 when not rendered) */
  private opacity(el: Element): number {
    let a = this.alpha.get(el);
    if (a === undefined) {
      const cs = getComputedStyle(el);
      const own = cs.visibility === 'hidden' || cs.display === 'none' ? 0 : parseFloat(cs.opacity);
      a = own * (el.parentElement ? this.opacity(el.parentElement) : 1);
      this.alpha.set(el, a);
    }
    return a;
  }

  /** does anything between the element and the page root cover the canvas or invite a click? */
  private covers(el: Element | null): boolean {
    if (!el || el === document.body || el === document.documentElement || el.tagName === 'MAIN') return false;
    let c = this.covered.get(el);
    if (c === undefined) {
      const cs = getComputedStyle(el);
      c = cs.cursor === 'pointer' || cs.backgroundImage !== 'none' || opaque(cs.backgroundColor) || this.covers(el.parentElement);
      this.covered.set(el, c);
    }
    return c;
  }

  /** true when (x, y) sits on a visible rendered character (± PAD) */
  private onText(x: number, y: number): boolean {
    const c = caretAt(x, y);
    if (!c || c.node.nodeType !== Node.TEXT_NODE) return false;
    const parent = c.node.parentElement;
    if (!parent || this.opacity(parent) < SEEN) return false;
    const len = (c.node.textContent ?? '').length;
    // the caret lands on the nearest boundary: test the characters on both sides
    for (let o = c.offset - 1; o <= c.offset; o++) {
      if (o < 0 || o >= len) continue;
      this.range.setStart(c.node, o);
      this.range.setEnd(c.node, o + 1);
      for (const r of this.range.getClientRects()) if (inside(r, x, y, PAD)) return true;
    }
    return false;
  }

  /** Is viewport point (x, y) bare Pixel Field? */
  empty(x: number, y: number): boolean {
    for (const r of this.hud) if (inside(r, x, y)) return false;
    for (const r of this.veils) if (inside(r, x, y, PAD)) return false;
    // the topmost thing the visitor can actually see there
    let target: Element | null = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (this.opacity(el) >= SEEN) {
        target = el;
        break;
      }
    }
    if (!target || target.closest(SOLID) || this.covers(target)) return false;
    return !this.onText(x, y);
  }
}

/** Is viewport point (x, y) bare Pixel Field? (A one-off check; for many points, keep one Page.) */
export function isEmptySpace(x: number, y: number): boolean {
  return new Page().empty(x, y);
}
