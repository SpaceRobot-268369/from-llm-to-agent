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
      {s.part && (
        <>
          <p className="part">{s.part.label}</p>
          <p className="card__partline">{s.part.line}</p>
        </>
      )}
      <p className="kicker kicker--center">{s.kicker}</p>
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
      {formula && <Formula text={formula} className="watch__formula" />}
    </div>
  );
}

export function Section({ s, index }: { s: SectionData; index: number }) {
  const style = { '--len': s.length } as CSSProperties;

  if (s.kind === 'hero') {
    const [first, second] = s.title.split(/ (?=to )/);
    return (
      <section id={s.id} className="sec sec--hero" style={style} ref={(el) => ticker.register(index, el)}>
        <div className="sec__sticky">
          <div className="sec__copy hero">
            <p className="kicker">{s.kicker}</p>
            <h1 className="hero__title">
              <span>{first}</span> <span>{second}</span>
            </h1>
            <p className="hero__lede">{s.lede}</p>
            {s.body?.map((b) => (
              <p key={b} className="hero__body">
                {b}
              </p>
            ))}
          </div>
          <p className="hero__cue" aria-hidden="true">
            {UI.scroll} <span>↓</span>
          </p>
        </div>
      </section>
    );
  }

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
            {s.unwrap && (
              <ul className="unwrap-list rv" style={{ '--at': next() } as CSSProperties}>
                {s.unwrap.map((u) => (
                  <li key={u.label} className={u.ref === 'new' ? 'is-new' : undefined}>
                    <span>{u.label}</span>
                    <i aria-hidden="true" />
                    <b>{u.ref === 'new' ? 'new' : `§ ${u.ref}`}</b>
                  </li>
                ))}
              </ul>
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
