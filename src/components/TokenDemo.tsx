import { useEffect, useRef, type CSSProperties } from 'react';
import { NEXT_TOKEN_DEMO } from '../content/sections';
import { placement } from '../engine/phases';
import { BEAT, TOKEN_STEPS, tokenStep } from '../engine/scenes/tokens';
import { ticker } from '../engine/ticker';

const { prompt, steps, note, spaceNote, textLabel, barsLabel } = NEXT_TOKEN_DEMO;
/** the tokens the demo appends, one per step (each step's likeliest candidate) */
const GEN = steps.slice(0, TOKEN_STEPS).map((c) => c[0].token);
/** how long (in steps) a new prediction's bars take to grow in */
const GROW = 0.4;

/** a leading space is part of the token: show it as “·” */
const show = (t: string) => t.replace(/^\s/, '·');
const textAt = (n: number) => [...prompt, ...GEN.slice(0, n)].join('');

/**
 * "The cat sat on the ?" → candidate next tokens with probability bars,
 * scroll-linked to the `tokens` scene beside it: both read the same scene
 * progress through tokenStep(), so each time the scene appends a token the
 * demo appends it too, and the "?" moves on to the next prediction.
 * DOM updates go through refs on change only — no React state per frame.
 */
export function TokenDemo({ at }: { at: number }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const fig = ref.current;
    const sec = fig?.closest('section');
    const index = sec ? ticker.indexOf(sec.id) : -1;
    if (!fig || index < 0) return;
    const line = fig.querySelector<HTMLElement>('.tokdemo__prompt')!;
    const gen = [...fig.querySelectorAll<HTMLElement>('.tokdemo__line:not(.tokdemo__line--sizer) .tokdemo__tok--gen')];
    const next = fig.querySelector<HTMLElement>('.tokdemo__line:not(.tokdemo__line--sizer) .tokdemo__tok--next')!;
    const lists = [...fig.querySelectorAll<HTMLElement>('.tokdemo__bars')];
    let lastN = -1;
    let lastPick: boolean | null = null;
    let lastG = -1;

    return ticker.onFrame((f) => {
      const { sp } = placement(index, f.progress[index], f);
      const st = tokenStep(sp, f.mobile);
      const n = st.n; // tokens appended so far = the prediction on show
      const pick = st.chosen && !st.landed;
      // a prediction's bars grow in from the moment it appears (the previous
      // step's landing; prediction 0 as the demo fades in); still under reduced motion
      const from = n - 1 + BEAT.LAND;
      const dur = n === TOKEN_STEPS ? 1 - BEAT.LAND : GROW;
      const g = f.reduced ? 1 : Math.min(1, Math.max(0, (st.s - from) / dur));

      if (n !== lastN) {
        gen.forEach((el, i) => {
          el.hidden = i >= n;
          el.classList.toggle('is-new', i === n - 1);
        });
        lists.forEach((el, q) => {
          const on = q === n;
          el.toggleAttribute('data-on', on);
          el.setAttribute('aria-hidden', String(!on));
        });
        line.setAttribute('aria-label', `${textLabel}: ${textAt(n)}`);
        lastN = n;
        lastG = -1;
        lastPick = null;
      }
      if (pick !== lastPick) {
        lists[n]?.toggleAttribute('data-pick', pick);
        next.classList.toggle('is-pick', pick);
        // like the diagram, one accent at a time: the pick takes it from the last token
        gen[n - 1]?.classList.toggle('is-new', !pick);
        lastPick = pick;
      }
      if (Math.abs(g - lastG) > 0.002 || (g === 1 && lastG !== 1)) {
        lists[n]?.style.setProperty('--g', g.toFixed(3));
        lastG = g;
      }
    });
  }, []);

  const tok = (t: string, i: number, cls = '') => (
    <span key={i} className={`tokdemo__tok${cls}`}>
      {show(t)}
    </span>
  );

  return (
    <figure ref={ref} className="tokdemo rv" style={{ '--at': at } as CSSProperties}>
      <div className="tokdemo__prompt" role="img" aria-label={`${textLabel}: ${textAt(0)}`}>
        {/* the finished line, invisible: reserves its height so wrapping never jumps */}
        <div className="tokdemo__line tokdemo__line--sizer" aria-hidden="true">
          {prompt.map((t, i) => tok(t, i))}
          {GEN.map((t, i) => tok(t, prompt.length + i, ' tokdemo__tok--gen'))}
          <span className="tokdemo__tok tokdemo__tok--next">?</span>
        </div>
        <div className="tokdemo__line" aria-hidden="true">
          {prompt.map((t, i) => tok(t, i))}
          {GEN.map((t, i) => (
            <span key={i} className="tokdemo__tok tokdemo__tok--gen" hidden>
              {show(t)}
            </span>
          ))}
          <span className="tokdemo__tok tokdemo__tok--next">?</span>
        </div>
      </div>
      <div className="tokdemo__steps">
        {steps.map((cands, q) => {
          const max = cands[0].p;
          return (
            <ul
              key={q}
              className="tokdemo__bars"
              aria-label={barsLabel}
              aria-hidden={q !== 0}
              data-on={q === 0 ? '' : undefined}
            >
              {cands.map((c, i) => (
                <li key={c.token} style={{ '--w': c.p / max, '--i': i } as CSSProperties}>
                  <code>
                    <span aria-hidden="true">{/^\s/.test(c.token) ? '·' : ''}</span>
                    {c.token.trimStart()}
                  </code>
                  <span className="tokdemo__bar">
                    <span />
                  </span>
                  <b>{Math.round(c.p * 100)}%</b>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
      <figcaption>
        {note} · {spaceNote}
      </figcaption>
    </figure>
  );
}
