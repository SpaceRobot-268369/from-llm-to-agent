import { useEffect, useRef, type CSSProperties } from 'react';
import { PHASES } from '../engine/phases';
import { chapterOf, topicsOf, UI, type Section as SectionData } from '../content/sections';
import { ticker } from '../engine/ticker';

/**
 * A chapter opener: one full-screen card in the chapter's signature colour —
 * giant pixel numeral, chapter name, thesis, and the topics inside. No
 * diagram. It holds for most of the scroll (the buffer), then lifts away.
 */
export function ChapterCard({ s, index }: { s: SectionData; index: number }) {
  const ch = chapterOf(s);
  const topics = topicsOf(s.chapter ?? 0);
  const tocRef = useRef<HTMLOListElement>(null);
  // once the card has lifted away its contents are not clickable or focusable
  useEffect(() => {
    let last: boolean | null = null;
    return ticker.onFrame((f) => {
      const gone = !f.mobile && f.progress[index] >= PHASES.part.headOut[1];
      if (gone !== last) {
        tocRef.current?.toggleAttribute('inert', gone);
        last = gone;
      }
    });
  }, [index]);
  return (
    <section
      id={s.id}
      className="sec sec--part mode-part"
      style={{ '--len': s.length } as CSSProperties}
      ref={(el) => ticker.register(index, el)}
      aria-labelledby={`${s.id}-title`}
    >
      <div className="sec__sticky">
        <div className="chapter">
          <p className="chapter__num" aria-hidden="true">
            {String(s.chapter).padStart(2, '0')}
          </p>
          <div className="chapter__text">
            <p className="kicker">{s.kicker}</p>
            <h2 className="chapter__title" id={`${s.id}-title`}>
              {s.title}
            </h2>
            {ch && <p className="chapter__line">{ch.line}</p>}
            <ol className="chapter__toc" aria-label={UI.chapterContents} ref={tocRef}>
              {topics.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => ticker.scrollToSection(ticker.indexOf(t.id), 0)}>
                    <span className="chapter__tocnum">{t.num}</span>
                    <span>{t.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
