import type { CSSProperties } from 'react';
import { UI, type Caption, type Section as SectionData } from '../content/sections';
import { modeOf, PHASES } from '../engine/phases';
import { ticker } from '../engine/ticker';
import { CodeBlock } from './CodeBlock';
import { Formula } from './Formula';
import { TokenDemo } from './TokenDemo';

/** Reveal stagger inside the READ act (fractions of --p). */
const STAGGER = 0.035;

/** The centred headline card that opens every section. */
export function HeadlineCard({ s }: { s: SectionData }) {
  return (
    <header className="card">
      <p className="kicker kicker--center">
        {s.num ? `${s.num} · ` : ''}
        {s.kicker}
      </p>
      <h2 className="card__title" id={`${s.id}-title`}>
        {s.title}
      </h2>
      {s.analogy && (
        <p className="card__analogy">
          <span className="card__label">{UI.plainWords}</span>
          {s.analogy}
        </p>
      )}
    </header>
  );
}

/** WATCH-phase captions, synced to the scene's progress via --sp. */
export function Watch({ steps, formula, label }: { steps: Caption[]; formula?: string; label: string }) {
  return (
    <div className="watch" role="group" aria-label={`${UI.watchLabel}: ${label}`}>
      <ol className="watch__steps">
        {steps.map((c, i) => (
          <li
            key={c.text}
            style={{ '--a': c.at, '--b': steps[i + 1]?.at ?? 2 } as CSSProperties}
          >
            <span className="watch__n" aria-hidden="true">
              {i + 1}/{steps.length}
            </span>
            <span>{c.text}</span>
          </li>
        ))}
      </ol>
      {formula && <Formula text={formula} className="watch__formula" ariaHidden />}
    </div>
  );
}

export function Section({ s, index }: { s: SectionData; index: number }) {
  const style = { '--len': s.length } as CSSProperties;

  const mode = modeOf(s) ?? 'read';
  let at = PHASES[mode].readIn[1] - 0.02;
  const next = () => {
    const v = at;
    at += STAGGER;
    return v;
  };

  return (
    <section
      id={s.id}
      className={`sec sec--concept mode-${mode} art-${s.art ?? 'right'}${s.highlight ? ' is-highlight' : ''}`}
      style={style}
      ref={(el) => ticker.register(index, el)}
      aria-labelledby={`${s.id}-title`}
    >
      <div className="sec__sticky">
        <HeadlineCard s={s} />

        <div className="col">
          <div className="sec__copy">
            {s.lede && <p className="lede">{s.lede}</p>}
            <p className="kicker" aria-hidden="true">
              {s.num ? `${s.num} · ` : ''}
              {s.kicker}
            </p>
            <p className="title" aria-hidden="true">
              {s.title}
            </p>
            {s.body?.map((b) => (
              <p key={b} className="body rv" style={{ '--at': next() } as CSSProperties}>
                {b}
              </p>
            ))}
            {s.demo === 'next-token' && <TokenDemo at={next()} />}
            {s.steps && (
              <ol className="steps rv" style={{ '--at': next() } as CSSProperties}>
                {s.steps.map((st) => (
                  <li key={st}>{st}</li>
                ))}
              </ol>
            )}
            {s.code && <CodeBlock code={s.code} at={next()} />}
            {s.products && (
            <div className="products rv" style={{ '--at': next() } as CSSProperties} role="group" aria-label={UI.productsLabel}>
              {s.products.map((pr, i) => (
                <div
                  key={pr.name}
                  className="products__item"
                  style={{ '--a': i === 0 ? -1 : pr.at, '--b': s.products![i + 1]?.at ?? 2 } as CSSProperties}
                >
                  <span className="products__n" aria-hidden="true">
                    {i + 1}/{s.products!.length}
                  </span>
                  <b className="products__name">{pr.name}</b>
                  <span className="products__by">{pr.by}</span>
                  <span className="products__where">{pr.where}</span>
                </div>
              ))}
            </div>
          )}
          {s.note && (
              <p className="note rv" style={{ '--at': next() } as CSSProperties}>
                {s.note}
              </p>
            )}
            {s.formula && <Formula text={s.formula} at={next()} />}
          </div>
        </div>

        {s.watch && <Watch steps={s.watch} formula={s.formula} label={s.label} />}
      </div>
    </section>
  );
}
