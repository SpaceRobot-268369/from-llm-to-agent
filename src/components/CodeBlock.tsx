import type { CSSProperties, ReactNode } from 'react';
import { UI, type Code } from '../content/sections';

// tags <user>, strings "…", comments (# … / // …), the cursor ▌, arrows → ←
const TOKEN = /(<\/?[a-z_]+>)|("[^"]*")|((?:^|\s)(?:#|\/\/).*$)|(▌)|([→←])/g;

function highlight(line: string, key: number): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [whole, tag, str, comment, cursor, arrow] = m;
    const k = `${key}-${m.index}`;
    if (tag) out.push(<span key={k} className="c-tag">{tag}</span>);
    else if (str) out.push(<span key={k} className="c-str">{str}</span>);
    else if (comment) out.push(<span key={k} className="c-com">{comment}</span>);
    else if (cursor) out.push(<span key={k} className="c-cursor" aria-hidden="true">{cursor}</span>);
    else if (arrow) out.push(<span key={k} className="c-arrow">{arrow}</span>);
    last = m.index + whole.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeBlock({ code, at }: { code: Code; at: number }) {
  const lines = code.text.split('\n');
  return (
    <pre className="code rv" style={{ '--at': at } as CSSProperties} tabIndex={0} role="region" aria-label={UI.codeLabel}>
      <code>
        {lines.map((l, i) => (
          <span key={i} className="code__line">
            {highlight(l, i)}
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  );
}
