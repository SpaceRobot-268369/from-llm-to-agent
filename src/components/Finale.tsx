import type { CSSProperties } from 'react';
import { FINALE, type Section as SectionData } from '../content/sections';
import { PHASES } from '../engine/phases';
import { Formula } from './Formula';
import { ticker } from '../engine/ticker';
import { HeadlineCard, Watch } from './Section';

/** same reveal rhythm as concept sections: start just before the read act settles */
const READ_START = PHASES.watch.readIn[1] - 0.02;
const STAGGER = 0.035;

export function Finale({ s, index }: { s: SectionData; index: number }) {
  const closingAt = READ_START + FINALE.ladder.length * STAGGER;
  return (
    <section
      id={s.id}
      className="sec sec--finale mode-watch"
      style={{ '--len': s.length } as CSSProperties}
      ref={(el) => ticker.register(index, el)}
      aria-labelledby={`${s.id}-title`}
    >
      <div className="sec__sticky">
        <HeadlineCard s={s} />

        <div className="col">
          <div className="sec__copy">
            <p className="kicker" aria-hidden="true">
              {s.kicker}
            </p>
            <p className="title" aria-hidden="true">
              {s.title}
            </p>
            <ol className="ladder">
              {FINALE.ladder.map((r, i) => (
                <li key={r.word} className="rv" style={{ '--at': READ_START + i * STAGGER } as CSSProperties}>
                  <b>{r.word}</b>
                  <span aria-hidden="true">→</span>
                  <span>{r.is}</span>
                </li>
              ))}
            </ol>
            <p className="closing rv" style={{ '--at': closingAt } as CSSProperties}>
              {FINALE.closing}
            </p>
            {s.formula && <Formula text={s.formula} at={closingAt + STAGGER} />}
          </div>
        </div>

        {s.watch && <Watch steps={s.watch} formula={s.formula} label={FINALE.watchLabel} />}
      </div>
    </section>
  );
}

/** Small credit lines — the page carries no reference list. */
export function Credits() {
  const c = FINALE.credit;
  return (
    <footer className="credits">
      <p>
        {c.lead} <b lang="zh-Hans">{c.author}</b> — <span lang="zh-Hans">《{c.title}》</span> ·{' '}
        <a href={c.youtube} target="_blank" rel="noreferrer">
          {c.youtubeLabel}
        </a>{' '}
        ·{' '}
        <a href={c.bilibili} target="_blank" rel="noreferrer">
          {c.bilibiliLabel}
        </a>
      </p>
      <p>
        {c.blogLead}{' '}
        <a href={c.blog} target="_blank" rel="noreferrer">
          {c.blogTitle}
        </a>
      </p>
    </footer>
  );
}
