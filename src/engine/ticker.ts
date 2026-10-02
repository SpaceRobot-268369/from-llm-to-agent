/**
 * The one requestAnimationFrame loop. Everything scroll-linked runs here:
 *   1. advance Lenis (smooth scroll)
 *   2. compute which section is current, its progress, and the blend into the next
 *   3. write `--p` on section elements and the blended palette on :root
 *   4. call subscribers (Pixel Field, HUD) with the frame
 *
 * Never add another rAF loop or scroll listener — subscribe with `ticker.onFrame`.
 */
import Lenis from 'lenis';
import { SECTIONS } from '../content/sections';
import { contrast, css, hex, mix, type RGB } from './color';
import { writePhaseVars } from './phases';

export type FrameColors = { bg: RGB; ink: RGB; px: RGB; accent: RGB };

export type Frame = {
  /** seconds since start (frozen at 0 under reduced motion) */
  t: number;
  /** real seconds since start, always advancing */
  clock: number;
  y: number;
  vw: number;
  vh: number;
  /** index of the current (sticky or last-entered) section */
  cur: number;
  /** cur + 1, or -1 at the end */
  next: number;
  /** progress of `cur` across its sticky phase, 0..1 */
  p: number;
  /** 0..1 while `next` slides in over one viewport height */
  blend: number;
  /** whole-page progress 0..1 */
  global: number;
  mobile: boolean;
  reduced: boolean;
  pointer: { x: number; y: number; on: boolean };
  colors: FrameColors;
  /** per-section progress, same indexing as SECTIONS */
  progress: number[];
  /**
   * Mobile only: scene progress for WATCH sections, driven by where the
   * steps list is on screen (so the animation plays while the steps are read).
   * null for sections without a steps list.
   */
  mobileScene: (number | null)[];
};

type Rec = {
  el: HTMLElement;
  top: number;
  height: number;
  lastP: number;
  /** the WATCH steps list, if the section has one (doc coordinates) */
  watch: HTMLElement | null;
  wTop: number;
  wBottom: number;
};

const PALETTES = SECTIONS.map((s) => ({
  bg: hex(s.palette.bg),
  ink: hex(s.palette.ink),
  px: hex(s.palette.px),
  accent: hex(s.palette.accent),
}));

const MOBILE_QUERY = '(max-width: 900px), (max-height: 640px)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

class Ticker {
  private recs: (Rec | undefined)[] = [];
  private subs = new Set<(f: Frame) => void>();

  private started = false;
  private raf = 0;
  private cleanups: (() => void)[] = [];
  private themeMeta: HTMLMetaElement | null = null;
  private lastTheme = '';
  private t0 = 0;
  private dirtyMeasure = true;
  private lastRoot = '';
  private lenis: Lenis | null = null;
  private mobileMq: MediaQueryList | null = null;
  private reducedMq: MediaQueryList | null = null;
  private ro: ResizeObserver | null = null;

  frame: Frame = {
    t: 0,
    clock: 0,
    y: 0,
    vw: 0,
    vh: 0,
    cur: 0,
    next: 1,
    p: 0,
    blend: 0,
    global: 0,
    mobile: false,
    reduced: false,
    pointer: { x: -1e4, y: -1e4, on: false },
    colors: { ...PALETTES[0] },
    progress: SECTIONS.map(() => 0),
    mobileScene: SECTIONS.map(() => null),
  };

  register(index: number, el: HTMLElement | null) {
    if (el) {
      this.recs[index] = { el, top: 0, height: 0, lastP: -1, watch: el.querySelector<HTMLElement>('.watch'), wTop: 0, wBottom: 0 };
    } else {
      this.recs[index] = undefined;
    }
    this.dirtyMeasure = true;
  }

  onFrame(cb: (f: Frame) => void): () => void {
    this.subs.add(cb);
    this.start();
    return () => this.subs.delete(cb);
  }

  /** Index of a section by id (-1 if unknown). */
  indexOf(id: string): number {
    return SECTIONS.findIndex((s) => s.id === id);
  }

  /** Smooth-scroll to a section's start (or slightly into it). */
  scrollToSection(index: number, into = 0) {
    const rec = this.recs[index];
    if (!rec) return;
    this.measure();
    const target = rec.top + Math.max(0, rec.height - this.frame.vh) * into;
    if (this.lenis) this.lenis.scrollTo(target, { duration: 1.4 });
    else window.scrollTo({ top: target, behavior: this.frame.reduced ? 'auto' : 'smooth' });
  }

  private start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.t0 = performance.now();
    this.mobileMq = window.matchMedia(MOBILE_QUERY);
    this.reducedMq = window.matchMedia(REDUCED_QUERY);
    this.themeMeta = document.querySelector('meta[name="theme-color"]');
    this.applyLenis();

    const on = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      this.cleanups.push(() => target.removeEventListener(type, fn, opts));
    };
    on(this.reducedMq, 'change', () => this.applyLenis());
    on(window, 'resize', () => (this.dirtyMeasure = true));
    this.ro = new ResizeObserver(() => (this.dirtyMeasure = true));
    this.ro.observe(document.body);
    document.fonts?.ready.then(() => (this.dirtyMeasure = true));

    const ptr = this.frame.pointer;
    on(
      window,
      'pointermove',
      (e) => {
        const pe = e as PointerEvent;
        if (pe.pointerType !== 'mouse') return;
        ptr.x = pe.clientX;
        ptr.y = pe.clientY;
        ptr.on = true;
      },
      { passive: true },
    );
    on(document.documentElement, 'pointerleave', () => (ptr.on = false));
    on(window, 'blur', () => (ptr.on = false));

    const loop = (now: number) => {
      this.tick(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Tear everything down (used by hot reload in dev). */
  destroy() {
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.ro?.disconnect();
    this.lenis?.destroy();
    this.lenis = null;
    this.subs.clear();
    this.started = false;
  }

  private applyLenis() {
    const reduced = !!this.reducedMq?.matches;
    if (reduced && this.lenis) {
      this.lenis.destroy();
      this.lenis = null;
    } else if (!reduced && !this.lenis) {
      this.lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, smoothWheel: true });
    }
  }

  private measure() {
    const y = window.scrollY;
    for (const rec of this.recs) {
      if (!rec) continue;
      const r = rec.el.getBoundingClientRect();
      rec.top = r.top + y;
      rec.height = r.height;
      if (rec.watch) {
        const w = rec.watch.getBoundingClientRect();
        rec.wTop = w.top + y;
        rec.wBottom = w.bottom + y;
      }
    }
    this.dirtyMeasure = false;
  }

  private tick(now: number) {
    const f = this.frame;
    const clock = (now - this.t0) / 1000;
    f.reduced = !!this.reducedMq?.matches;
    f.mobile = !!this.mobileMq?.matches;
    f.clock = clock;
    f.t = f.reduced ? 0 : clock;
    if (this.lenis) this.lenis.raf(now);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw !== f.vw || vh !== f.vh) this.dirtyMeasure = true;
    f.vw = vw;
    f.vh = vh;
    if (this.dirtyMeasure) this.measure();

    const y = this.lenis ? this.lenis.scroll : window.scrollY;
    f.y = y;
    const docH = document.documentElement.scrollHeight;
    f.global = Math.min(1, Math.max(0, y / Math.max(1, docH - vh)));

    // current section = last one whose top has reached the viewport top
    let cur = 0;
    for (let i = 0; i < this.recs.length; i++) {
      const rec = this.recs[i];
      if (rec && rec.top <= y + 1) cur = i;
    }
    const next = cur + 1 < SECTIONS.length && this.recs[cur + 1] ? cur + 1 : -1;

    for (let i = 0; i < this.recs.length; i++) {
      const rec = this.recs[i];
      if (!rec) continue;
      const span = rec.height - vh;
      const p = span > 1 ? (y - rec.top) / span : y >= rec.top ? 1 : 0;
      const pc = p < 0 ? 0 : p > 1 ? 1 : p;
      f.progress[i] = pc;
      if (f.mobile && rec.watch) {
        // the steps list enters at the bottom → its top reaches the art band's
        // lower edge (the scene finishes while it is still visible), and never
        // later than the end of the page
        const a = rec.wTop - vh * 0.92;
        const b = Math.min(rec.wTop - vh * 0.45, docH - vh);
        const m = b > a ? (y - a) / (b - a) : 0;
        f.mobileScene[i] = m < 0 ? 0 : m > 1 ? 1 : m;
      } else {
        f.mobileScene[i] = null;
      }
      if (Math.abs(pc - rec.lastP) > 0.0004) {
        rec.el.style.setProperty('--p', pc.toFixed(4));
        rec.lastP = pc;
      }
    }

    f.cur = cur;
    f.next = next;
    f.p = f.progress[cur] ?? 0;
    if (next >= 0) {
      const rel = this.recs[next]!.top - y;
      const b = 1 - rel / vh;
      f.blend = b < 0 ? 0 : b > 1 ? 1 : b;
    } else {
      f.blend = 0;
    }

    // palette: blend bg / pixels / accent; ink snaps to whichever section ink
    // contrasts more with the current background (never a mid-grey on mid-grey)
    const A = PALETTES[cur];
    const B = next >= 0 ? PALETTES[next] : A;
    const k = f.blend;
    // a chapter change wipes rather than cross-fades: no off-palette in-between
    const chapterChange = next >= 0 && SECTIONS[cur].chapter !== SECTIONS[next].chapter;
    const bg = chapterChange ? (k < 0.5 ? A.bg : B.bg) : mix(A.bg, B.bg, k);
    const ink = contrast(A.ink, bg) >= contrast(B.ink, bg) ? A.ink : B.ink;
    f.colors.bg = bg;
    f.colors.ink = ink;
    f.colors.px = mix(A.px, B.px, k);
    f.colors.accent = mix(A.accent, B.accent, k);

    const rootKey = `${css(bg)}|${css(ink)}|${css(f.colors.accent)}`;
    if (rootKey !== this.lastRoot) {
      const rs = document.documentElement.style;
      rs.setProperty('--bg', css(bg));
      rs.setProperty('--ink', css(ink));
      rs.setProperty('--accent', css(f.colors.accent));
      rs.setProperty('--px', css(f.colors.px));
      this.lastRoot = rootKey;
    }
    // mobile browser chrome follows the page: switch at the blend midpoint
    const theme = css(k < 0.5 ? A.bg : B.bg);
    if (theme !== this.lastTheme && this.themeMeta) {
      this.themeMeta.content = theme;
      this.lastTheme = theme;
    }

    for (const cb of this.subs) cb(f);
  }
}

export const ticker = new Ticker();

// phase variables exist before the first render, so acts never all show at once
if (typeof document !== 'undefined') writePhaseVars(document.documentElement.style);

if (import.meta.hot) import.meta.hot.dispose(() => ticker.destroy());
