/**
 * HUD chrome: top bar, progress rail, stack trail. All per-frame updates go
 * through refs — no React state changes on scroll.
 */
import { useEffect, useRef } from 'react';
import { chapterOf, SECTIONS, UI } from '../content/sections';
import { range } from '../engine/noise';
import { placement } from '../engine/phases';
import { ticker } from '../engine/ticker';


export function TopBar() {
  const tokRef = useRef<HTMLElement>(null);
  const secRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // rough token estimate of the whole page: ~4 characters per token
    const total = Math.round((document.querySelector('main')?.textContent?.length ?? 0) / 4);
    let lastTok = -1;
    let lastCur = -1;
    return ticker.onFrame((f) => {
      const tok = Math.round(total * f.global);
      if (tok !== lastTok) {
        tokRef.current!.textContent = tok.toLocaleString('en-US');
        lastTok = tok;
      }
      if (f.cur !== lastCur) {
        const s = SECTIONS[f.cur];
        const ch = chapterOf(s);
        secRef.current!.textContent = ch
          ? s.kind === 'part'
            ? UI.chapter(ch.n, ch.name)
            : `${UI.chapter(ch.n, ch.name)}  /  ${s.num} ${s.label}`
          : s.label;
        lastCur = f.cur;
      }
    });
  }, []);

  return (
    <header className="topbar">
      <span className="topbar__l">
        {UI.tokensRead} <b ref={tokRef}>0</b>
      </span>
      <a
        className="topbar__mark"
        href="#hero"
        onClick={(e) => {
          e.preventDefault();
          ticker.scrollToSection(0);
        }}
      >
        {UI.wordmark.from}
        <span aria-hidden="true">→</span>
        <span className="sr-only">{UI.wordmark.sr}</span>
        {UI.wordmark.to}
      </a>
      <span className="topbar__r" ref={secRef} aria-live="off" />
    </header>
  );
}

export function ProgressRail() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let last = -1;
    return ticker.onFrame((f) => {
      if (f.cur === last) return;
      navRef.current!.querySelectorAll('button').forEach((b, i) => {
        b.toggleAttribute('data-active', i === f.cur);
        b.toggleAttribute('data-past', i < f.cur);
        if (i === f.cur) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      last = f.cur;
    });
  }, []);

  return (
    <nav className="rail" ref={navRef} aria-label={UI.railLabel}>
      {SECTIONS.map((s, i) => {
        const name = s.kind === 'part' ? UI.chapter(s.chapter ?? 0, s.label) : s.num ? `${s.num} ${s.label}` : s.label;
        return (
          <button
            key={s.id}
            type="button"
            className={s.kind === 'part' ? 'is-chapter' : s.highlight ? 'is-highlight' : undefined}
            onClick={() => ticker.scrollToSection(i, 0)}
            aria-label={name}
            title={name}
          >
            {s.kind === 'part' ? <b aria-hidden="true">{s.chapter}</b> : <i />}
          </button>
        );
      })}
    </nav>
  );
}

/** wrappers in build order, deduplicated (LLM appears once) */
const WRAPS: { index: number; wrap: string }[] = [];
SECTIONS.forEach((s, index) => {
  if (s.wrap && !WRAPS.some((w) => w.wrap === s.wrap)) WRAPS.push({ index, wrap: s.wrap });
});
const FINALE_INDEX = SECTIONS.findIndex((s) => s.kind === 'finale');

function nest(names: string[]): string {
  if (names.length === 0) return '';
  const inner = names[0];
  const outer = names.slice(1).reverse();
  if (outer.length <= 3) {
    return outer.map((n) => `${n}(`).join(' ') + (outer.length ? ' ' : '') + inner + (outer.length ? ' ' : '') + ')'.repeat(outer.length);
  }
  const shown = outer.slice(0, 3);
  return `${shown.map((n) => `${n}(`).join(' ')} … ${inner} ${')'.repeat(outer.length)}`;
}

export function StackTrail() {
  const elRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef<HTMLElement>(null);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let last = '';
    return ticker.onFrame((f) => {
      let count = WRAPS.filter((w) => w.index <= f.cur).length;
      if (f.cur === FINALE_INDEX) {
        // unwind on the same clock as the collapsing boxes (unwrap.ts)
        const sp = placement(FINALE_INDEX, f.p, f).sp;
        count = Math.max(1, Math.round(WRAPS.length * (1 - range(0.05, 0.8, sp))));
      }
      const names = WRAPS.slice(0, count).map((w) => w.wrap);
      const key = `${count}|${f.cur === 0}`;
      if (key === last) return;
      elRef.current!.toggleAttribute('data-hidden', f.cur === 0);
      depthRef.current!.textContent = UI.boxes(count - 1);
      codeRef.current!.textContent = nest(names);
      last = key;
    });
  }, []);

  return (
    <div className="trail" ref={elRef} aria-hidden="true">
      <span className="trail__depth" ref={depthRef} />
      <code className="trail__code" ref={codeRef} />
    </div>
  );
}

/** Bottom-right: back to the top, once you've scrolled most of a screen. */
export function BackToTop() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let last: boolean | null = null;
    return ticker.onFrame((f) => {
      const show = f.y > f.vh * 0.8;
      if (show !== last) {
        ref.current?.toggleAttribute('data-show', show);
        if (ref.current) ref.current.tabIndex = show ? 0 : -1;
        last = show;
      }
    });
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      className="totop"
      aria-label={UI.backToTopLabel}
      title={UI.backToTopLabel}
      onClick={() => ticker.scrollToSection(0, 0)}
    >
      <span aria-hidden="true">↑</span> {UI.backToTop}
    </button>
  );
}
