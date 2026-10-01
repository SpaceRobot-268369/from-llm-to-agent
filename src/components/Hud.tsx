/**
 * HUD chrome: top bar, progress rail, stack trail. All per-frame updates go
 * through refs — no React state changes on scroll.
 */
import { useEffect, useRef } from 'react';
import { SECTIONS, UI } from '../content/sections';
import { range } from '../engine/noise';
import { placement } from '../engine/phases';
import { ticker } from '../engine/ticker';

const LAST = SECTIONS.length - 1;
const pad2 = (n: number) => String(n).padStart(2, '0');

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
        secRef.current!.textContent = `${pad2(f.cur)} / ${pad2(LAST)} · ${SECTIONS[f.cur].label}`;
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
        llm<span aria-hidden="true">→</span>
        <span className="sr-only"> to </span>agent
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
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={s.highlight ? 'is-highlight' : undefined}
          onClick={() => ticker.scrollToSection(i, i === 0 ? 0 : 0.3)}
          aria-label={`${pad2(i)} ${s.label}`}
          title={`${pad2(i)} · ${s.label}`}
        >
          <i />
        </button>
      ))}
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
