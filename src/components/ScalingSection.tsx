import { useEffect, useRef, type CSSProperties } from 'react';
import { SCALING, type Section as SectionData } from '../content/sections';
import { lerp, smoothstep } from '../engine/noise';
import { growth } from '../engine/scenes/scaling';
import { ticker } from '../engine/ticker';
import { Formula } from './Formula';
import { HeadlineCard } from './Section';

const MS = SCALING.milestones;
const L = SCALING.labels;

export function fmtShort(n: number): string {
  if (n >= 1e12) return `${+(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  return `${+(n / 1e6).toFixed(0)}M`;
}

// ── chart geometry (SVG units) ────────────────────────────────────────────
const P0 = { x: 30, y: 20 };
const P1 = { x: 196, y: 96 };
const at = (f: number) => ({ x: lerp(P0.x, P1.x, f), y: lerp(P0.y, P1.y, f) });

/** pixel-style dotted line: small squares every `step` units */
function pixelLine(x0: number, y0: number, x1: number, y1: number, step: number, size: number, skip = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.floor(len / step));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i += skip) {
    const f = i / n;
    out.push({ x: Math.round(lerp(x0, x1, f) - size / 2), y: Math.round(lerp(y0, y1, f) - size / 2) });
  }
  return out;
}

const MAIN = pixelLine(P0.x, P0.y, P1.x, P1.y, 5, 3);
// the fork at the frontier: one branch keeps falling, one flattens
const FORK_A = pixelLine(P1.x, P1.y, 236, 115, 6, 3, 2);
const FORK_B = pixelLine(P1.x, P1.y, 236, 98, 6, 3, 2);

export function ScalingSection({ s, index }: { s: SectionData; index: number }) {
  const paramsRef = useRef<HTMLElement>(null);
  const shortRef = useRef<HTMLElement>(null);
  const tokensRef = useRef<HTMLElement>(null);
  const yearRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const dotRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    let lastActive = -1;
    let lastParams = '';
    return ticker.onFrame((f) => {
      if (f.cur !== index && f.next !== index) return;
      const p = f.progress[index];
      const m = growth(p) * (MS.length - 1);
      const i0 = Math.min(MS.length - 1, Math.floor(m));
      const i1 = Math.min(MS.length - 1, i0 + 1);
      const fr = smoothstep(0.35, 0.65, m - i0);
      // highlight the row the counter is rolling toward, as soon as it starts rolling
      const active = fr > 0 ? i1 : i0;

      // parameters: rest on exact milestone values, roll quickly between them
      const a = MS[i0].params;
      const b = MS[i1].params;
      let paramsText: string;
      let short = '';
      if (MS[active].params === null) {
        paramsText = L.undisclosed;
      } else if (a !== null && b !== null) {
        const v = Math.pow(10, lerp(Math.log10(a), Math.log10(b), fr));
        paramsText = Math.round(v).toLocaleString('en-US');
        short = fmtShort(v);
      } else {
        const v = MS[active].params!;
        paramsText = v.toLocaleString('en-US');
        short = fmtShort(v);
      }
      if (paramsText !== lastParams) {
        paramsRef.current!.textContent = paramsText;
        paramsRef.current!.classList.toggle('is-text', MS[active].params === null);
        shortRef.current!.textContent = short;
        lastParams = paramsText;
      }

      if (active !== lastActive) {
        const ms = MS[active];
        tokensRef.current!.textContent =
          ms.tokensLabel ?? (ms.tokens !== null ? fmtShort(ms.tokens) : ms.params === null ? L.undisclosed : '—');
        yearRef.current!.textContent = ms.year;
        listRef.current!.querySelectorAll('li').forEach((li, i) => li.toggleAttribute('data-active', i === active));
        lastActive = active;
      }

      const pt = at(growth(p));
      dotRef.current!.setAttribute('x', (pt.x - 4).toFixed(1));
      dotRef.current!.setAttribute('y', (pt.y - 4).toFixed(1));
    });
  }, [index]);

  return (
    <section
      id={s.id}
      className="sec sec--scaling mode-scaling is-highlight"
      style={{ '--len': s.length } as CSSProperties}
      ref={(el) => ticker.register(index, el)}
      aria-labelledby={`${s.id}-title`}
    >
      <div className="sec__sticky scaling">
        <HeadlineCard s={s} />
        <div className="scaling__copy">
          <p className="kicker" aria-hidden="true">
            {s.kicker}
          </p>
          <p className="title" aria-hidden="true">
            {s.title}
          </p>
          <div className="scaling__swap">
            <div className="scaling__intro">
              {s.body?.map((b) => (
                <p key={b} className="body">
                  {b}
                </p>
              ))}
              {s.formula && <Formula text={s.formula} />}
              <p className="scaling__cite">{L.cite}</p>
            </div>
            <ol className="scaling__milestones" ref={listRef}>
              {MS.map((ms) => (
                <li key={ms.model}>
                  <span className="ms__model">{ms.model}</span>
                  <span className="ms__year">{ms.year}</span>
                  <span className="ms__params">{ms.params ? fmtShort(ms.params) : '?'}</span>
                  <span className="ms__caption">{ms.caption}</span>
                </li>
              ))}
            </ol>
          </div>
          <dl className="scaling__counters">
            <div className="counter counter--params">
              <dt>
                {L.params} <span ref={shortRef} className="counter__short" />
              </dt>
              <dd ref={paramsRef} className="pixelnum">
                {(MS[0].params ?? 0).toLocaleString('en-US')}
              </dd>
            </div>
            <div className="counter">
              <dt>{L.tokens}</dt>
              <dd ref={tokensRef} className="pixelnum pixelnum--sm">
                —
              </dd>
            </div>
            <div className="counter">
              <dt>{L.year}</dt>
              <dd ref={yearRef} className="pixelnum pixelnum--sm">
                {MS[0].year}
              </dd>
            </div>
          </dl>
        </div>

        <figure className="scaling__chart" aria-hidden="true">
          <svg viewBox="0 0 260 140" shapeRendering="crispEdges">
            <line x1="22" y1="8" x2="22" y2="122" className="axis" />
            <line x1="22" y1="122" x2="250" y2="122" className="axis" />
            <g className="chart__main">
              {MAIN.map((d, i) => (
                <rect key={i} x={d.x} y={d.y} width="3" height="3" />
              ))}
            </g>
            <g className="chart__ticks">
              {MS.map((_, i) => {
                const pt = at(i / (MS.length - 1));
                return <rect key={i} x={pt.x - 3} y={pt.y - 3} width="6" height="6" />;
              })}
            </g>
            <g className="chart__fork">
              {FORK_A.map((d, i) => (
                <rect key={`a${i}`} x={d.x} y={d.y} width="3" height="3" />
              ))}
              {FORK_B.map((d, i) => (
                <rect key={`b${i}`} x={d.x} y={d.y} width="3" height="3" />
              ))}
              <text x="242" y="110">
                ?
              </text>
            </g>
            <rect ref={dotRef} className="chart__dot" x={P0.x - 4} y={P0.y - 4} width="8" height="8" />
            <text x="26" y="134" className="chart__label">
              {L.chartX} →
            </text>
            <text x="14" y="118" className="chart__label" transform="rotate(-90 14 118)">
              {L.chartY} →
            </text>
          </svg>
          <figcaption>{L.chartNote}</figcaption>
        </figure>

        <div className="scaling__question">
          <p className="q">{SCALING.question}</p>
          <p className="qsub">{SCALING.questionSub}</p>
        </div>
      </div>
    </section>
  );
}
