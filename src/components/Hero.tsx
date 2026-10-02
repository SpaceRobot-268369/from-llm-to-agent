/**
 * The hero: a centred headline, framed by the pixel boxes (hero scene), with
 * the buzzword soup — pixel stickers SCATTERED around it, each floating in
 * place (with the odd hop and blink). When the loader finishes, the stickers
 * burst out of the centre to their spots; scrolling pulls them back in (the
 * same move, reversed). Each sticker is a button that jumps to its topic.
 *
 * Layout pass (on resize / font load): measure the headline's real extent
 * (the "hole"), share it with the canvas (heroHole), then scatter the
 * stickers by best-candidate sampling — each one tries many seeded random
 * spots and keeps the one farthest from the stickers already placed, never
 * touching the headline, the HUD or another sticker. Seeded, so the scatter is
 * the same on every visit. Stickers that can't find room (small screens) are
 * left out, lowest priority first.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { HERO_WORDS, UI, type Section as SectionData } from '../content/sections';
import { BURST, intro } from '../engine/intro';
import { heroHole } from '../engine/layout';
import { hash2 } from '../engine/noise';
import { ticker } from '../engine/ticker';

/** overshooting ease for the burst */
function easeOutBack(e: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (e - 1) ** 3 + c1 * (e - 1) ** 2;
}

/** clearance around the headline, the HUD and between stickers (px) */
const PAD = 14;
const TOP_BAR = 50;
const RAIL = 44;
const CUE = 52;
/** candidate spots tried per sticker */
const TRIES = 90;
/** scroll: when stickers start being pulled in, how long each pull takes, how staggered */
const PULL_START = 0.05;
const PULL_SPAN = 0.28;
const PULL_STAGGER = 0.3;

type R = { l: number; t: number; r: number; b: number };
const hits = (a: R, b: R) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

export function Hero({ s, index }: { s: SectionData; index: number }) {
  const textRef = useRef<HTMLDivElement>(null);
  const buzzRef = useRef<HTMLDivElement>(null);
  const [first, second] = s.title.split(/ (?=to )/);

  useEffect(() => {
    const text = textRef.current!;
    const buzz = buzzRef.current!;
    const chips = [...buzz.querySelectorAll<HTMLElement>('.buzz__w')];
    let pos: [number, number][] = chips.map(() => [0, 0]);
    let shown: boolean[] = chips.map(() => false);
    let size: [number, number][] = [];
    let centre: [number, number] = [0, 0];
    let ready = false;

    const measure = () => {
      const W = buzz.clientWidth;
      const H = buzz.clientHeight;
      if (!W || !H) return;
      const base = buzz.getBoundingClientRect();
      const t = text.getBoundingClientRect();
      const hole: R = { l: t.left - base.left - PAD, t: t.top - base.top - PAD, r: t.right - base.left + PAD, b: t.bottom - base.top + PAD };
      heroHole.x = hole.l / W;
      heroHole.y = hole.t / H;
      heroHole.w = (hole.r - hole.l) / W;
      heroHole.h = (hole.b - hole.t) / H;
      centre = [(hole.l + hole.r) / 2, (hole.t + hole.b) / 2];
      size = chips.map((c) => [c.offsetWidth, c.offsetHeight]);

      // the free area: below the top bar, left of the rail, above the scroll cue
      const area: R = { l: 10, t: TOP_BAR, r: W - RAIL, b: H - CUE };
      const blocks: R[] = [hole];
      pos = chips.map(() => [0, 0]);
      shown = chips.map(() => false);
      for (let i = 0; i < chips.length; i++) {
        const [w, h] = size[i];
        let best: [number, number] | null = null;
        let bestScore = -1;
        for (let k = 0; k < TRIES; k++) {
          const x = area.l + w / 2 + hash2(i, k, 401) * (area.r - area.l - w);
          const y = area.t + h / 2 + hash2(i, k, 409) * (area.b - area.t - h);
          const box: R = { l: x - w / 2 - PAD / 2, t: y - h / 2 - PAD / 2, r: x + w / 2 + PAD / 2, b: y + h / 2 + PAD / 2 };
          if (blocks.some((bl) => hits(box, bl))) continue;
          // farthest from everything already placed (and from the headline) → an even scatter
          let score = Infinity;
          for (let j = 0; j < i; j++) {
            if (!shown[j]) continue;
            score = Math.min(score, Math.hypot(x - pos[j][0], y - pos[j][1]));
          }
          const dx = Math.max(hole.l - x, 0, x - hole.r);
          const dy = Math.max(hole.t - y, 0, y - hole.b);
          score = Math.min(score, Math.hypot(dx, dy) * 1.6 + 60);
          if (score > bestScore) {
            bestScore = score;
            best = [x, y];
          }
        }
        if (!best) continue;
        pos[i] = best;
        shown[i] = true;
        const [x, y] = best;
        blocks.push({ l: x - w / 2 - PAD / 2, t: y - h / 2 - PAD / 2, r: x + w / 2 + PAD / 2, b: y + h / 2 + PAD / 2 });
      }
      chips.forEach((c, i) => c.classList.toggle('is-off', !shown[i]));
      ready = true;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(buzz);
    ro.observe(text);
    document.fonts?.ready.then(measure);

    const off = ticker.onFrame((f) => {
      if (!ready || (f.cur !== index && f.next !== index)) return;
      const p = f.progress[index];
      // intro burst: out of the centre once the loader is done
      const since = intro.at < 0 ? -1 : f.clock - intro.at;
      for (let i = 0; i < chips.length; i++) {
        if (!shown[i]) continue;
        const e = f.reduced ? (intro.at < 0 ? 0 : 1) : since < 0 ? 0 : Math.min(1, Math.max(0, (since - hash2(i, 2, 91) * BURST.stagger) / BURST.flight));
        const out = e >= 1 ? 1 : easeOutBack(e);
        let x = centre[0] + (pos[i][0] - centre[0]) * out;
        let y = centre[1] + (pos[i][1] - centre[1]) * out;
        // scroll: pulled back into the headline, one after another
        const pull = Math.min(1, Math.max(0, (p - PULL_START - hash2(i, 1, 77) * PULL_STAGGER) / PULL_SPAN));
        const k = pull * pull;
        x += (centre[0] - x) * k;
        y += (centre[1] - y) * k;
        const scale = (0.25 + 0.75 * Math.min(1, e * 1.3)) * (1 - 0.85 * k);
        const alpha = Math.min(1, e * 3) * (1 - k);
        const el = chips[i];
        el.style.transform = `translate3d(${(x - size[i][0] / 2).toFixed(1)}px, ${(y - size[i][1] / 2).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        el.style.opacity = alpha.toFixed(3);
        // not clickable while hidden, bursting in, or pulled away
        el.tabIndex = alpha > 0.6 ? 0 : -1;
        el.style.pointerEvents = alpha > 0.6 ? '' : 'none';
      }
    });
    return () => {
      ro.disconnect();
      off();
    };
  }, [index]);

  return (
    <section id={s.id} className="sec sec--hero" style={{ '--len': s.length } as CSSProperties} ref={(el) => ticker.register(index, el)}>
      <div className="sec__sticky">
        <div className="buzz" ref={buzzRef}>
          {HERO_WORDS.map((b, i) => {
            const r = (k: number) => hash2(i, k, 77);
            const style = {
              '--dur': `${(5.5 + r(2) * 4).toFixed(2)}s`,
              '--delay': `${(-r(3) * 9).toFixed(2)}s`,
              '--r': `${((r(4) - 0.5) * 7).toFixed(1)}deg`,
            } as CSSProperties;
            return (
              <button
                key={b.w}
                type="button"
                className={`buzz__w buzz__w--${b.size ?? 1}`}
                style={style}
                aria-label={UI.goTo(b.w)}
                title={UI.goTo(b.w)}
                onClick={() => ticker.scrollToSection(ticker.indexOf(b.to), 0)}
              >
                <span className={`buzz__chip${b.accent ? ' is-accent' : ''}`}>
                  {b.face && (
                    <i className="buzz__face" style={{ '--blink': `${(3 + r(5) * 4).toFixed(2)}s` } as CSSProperties}>
                      <b />
                      <b />
                    </i>
                  )}
                  {b.w}
                </span>
              </button>
            );
          })}
        </div>
        <div className="hero2" ref={textRef}>
          <p className="kicker kicker--center">{s.kicker}</p>
          <h1 className="hero__title">
            <span>{first}</span> <span>{second}</span>
          </h1>
          <p className="hero__lede">{s.lede}</p>
          {s.body?.map((b) => (
            <p key={b} className="hero__chapters">
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
