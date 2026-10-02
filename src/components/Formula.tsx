import type { CSSProperties, ReactNode } from 'react';

/** Renders `_x` as subscript and `^x` as superscript. */
function parse(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /([_^])([\w.]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    out.push(m[1] === '_' ? <sub key={m.index}>{m[2]}</sub> : <sup key={m.index}>{m[2]}</sup>);
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

export function Formula({ text, at, className = '', ariaHidden }: { text: string; at?: number; className?: string; ariaHidden?: boolean }) {
  return (
    <p
      className={`formula ${at !== undefined ? 'rv' : ''} ${className}`}
      style={at !== undefined ? ({ '--at': at } as CSSProperties) : undefined}
      aria-hidden={ariaHidden || undefined}
    >
      <code>{parse(text)}</code>
    </p>
  );
}
