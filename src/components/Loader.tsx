/**
 * The loading screen: a row of pixel cells that fills as the page gets ready
 * (fonts loaded, first frame painted, a short minimum so it never flashes).
 * When it completes, the bar collapses into one square, the overlay fades, and
 * `intro.at` is set — the hero's stickers burst out of the centre from then.
 */
import { useEffect, useRef, useState } from 'react';
import { UI } from '../content/sections';
import { intro } from '../engine/intro';
import { ticker } from '../engine/ticker';

const CELLS = 16;
/** never shorter than this, so the loader reads as a moment, not a flicker (s) */
const MIN_TIME = 1.1;
/** overlay fade-out (ms), matched in CSS */
const FADE_MS = 650;

export function Loader() {
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading');
  const barRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.intro = 'loading';
    let fontsReady = false;
    document.fonts?.ready.then(() => (fontsReady = true));
    if (!document.fonts) fontsReady = true;
    let start = -1;
    let shown = 0;
    let lastCells = -1;
    let finished = false;

    const off = ticker.onFrame((f) => {
      if (finished) return;
      if (start < 0) start = f.clock;
      const elapsed = f.clock - start;
      // readiness: fonts are most of it; time fills the rest so it never jumps to 100
      const target = Math.min(1, (fontsReady ? 0.7 : 0.35) + Math.min(0.3, (elapsed / MIN_TIME) * 0.3));
      shown += (target - shown) * (f.reduced ? 1 : 0.12);
      if (target >= 1 && shown > 0.995) shown = 1;
      const cells = Math.floor(shown * CELLS + 1e-6);
      if (cells !== lastCells) {
        barRef.current?.querySelectorAll('i').forEach((c, i) => c.toggleAttribute('data-on', i < cells));
        lastCells = cells;
      }
      if (pctRef.current) pctRef.current.textContent = `${String(Math.round(shown * 100)).padStart(3, '0')}%`;

      if (shown >= 1 && fontsReady && elapsed >= (f.reduced ? 0 : MIN_TIME)) {
        finished = true;
        // the burst starts as the overlay begins to fade
        intro.at = f.reduced ? 0 : f.clock + 0.25;
        root.dataset.intro = 'done';
        setPhase('leaving');
        window.setTimeout(() => setPhase('gone'), f.reduced ? 0 : FADE_MS);
      }
    });
    return () => {
      off();
    };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div className={`loader${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-live="polite" aria-label={UI.loadingLabel}>
      <div className="loader__inner">
        <div className="loader__bar" ref={barRef} aria-hidden="true">
          {Array.from({ length: CELLS }, (_, i) => (
            <i key={i} style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <p className="loader__text">
          {UI.loading} <span ref={pctRef}>000%</span>
        </p>
      </div>
    </div>
  );
}
