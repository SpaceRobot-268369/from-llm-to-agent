import type { CSSProperties } from 'react';
import { NEXT_TOKEN_DEMO } from '../content/sections';

/** "The cat sat on the ▌" → candidate next tokens with probability bars. */
export function TokenDemo({ at }: { at: number }) {
  const { prompt, candidates, note, spaceNote } = NEXT_TOKEN_DEMO;
  const pieces = prompt.split(/(?=\s)/); // keep leading spaces, like real tokens
  const max = candidates[0].p;
  return (
    <figure className="tokdemo rv" style={{ '--at': at } as CSSProperties}>
      <div className="tokdemo__prompt" role="img" aria-label={`Prompt: ${prompt}`}>
        {pieces.map((t, i) => (
          <span key={i} className="tokdemo__tok">
            {t.replace(/^\s/, '·')}
          </span>
        ))}
        <span className="tokdemo__tok tokdemo__tok--next" aria-hidden="true">
          ?
        </span>
      </div>
      <ul className="tokdemo__bars">
        {candidates.map((c, i) => (
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
      <figcaption>
        {note} · {spaceNote}
      </figcaption>
    </figure>
  );
}
