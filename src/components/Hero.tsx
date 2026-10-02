/**
 * The hero: a centred headline, framed by a compact band of pixel boxes (hero
 * scene), with the buzzword soup — pixel stickers SCATTERED around it, each
 * floating in place (with the odd hop and blink). When the loader finishes,
 * the stickers burst out of the centre to their spots; scrolling pulls them
 * back in (the same move, reversed). Each sticker is a button that jumps to
 * its topic; under the lede, one ink chip per chapter jumps to its card.
 *
 * Layout pass (on resize / font load): measure the headline's real extent
 * (the "hole"), share it with the canvas (heroHole), work out how many frame
 * rings fit between it and the HUD (the band), then scatter the stickers by
 * best-candidate sampling — each one tries many seeded random spots and keeps
 * the one farthest from the stickers already placed, never touching the band,
 * the HUD or another sticker. Seeded, so the scatter is the same on every
 * visit. Stickers that can't find room (small screens) are left out, lowest
 * priority first.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { CHAPTERS, HERO_WORDS, SECTIONS, UI, type Section as SectionData } from '../content/sections';
import { BURST, intro } from '../engine/intro';
import { artRect, BASE_CELL_DESKTOP, BASE_CELL_MOBILE, grid, HERO_RINGS, heroHole, heroRing } from '../engine/layout';
import { hash2 } from '../engine/noise';
import { ticker } from '../engine/ticker';

/** overshooting ease for the burst */
function easeOutBack(e: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (e - 1) ** 3 + c1 * (e - 1) ** 2;
}

/** clearance around the headline, the frame band, the HUD and between stickers (px) */
const PAD = 14;
const TOP_BAR = 50;
const RAIL = 56;
const CUE = 52;
/** extra headroom for the stickers' float hop, so it never rises into the top bar */
const FLOAT = 12;
/** candidate spots tried per sticker */
const TRIES = 90;
/** scroll: when stickers start being pulled in, how long each pull takes, how staggered */
const PULL_START = 0.05;
const PULL_SPAN = 0.28;
const PULL_STAGGER = 0.3;

/** the chapter chips: built from CHAPTERS, each jumping to its chapter card */
const CHAPTER_LINKS = CHAPTERS.map((c) => ({
  ...c,
  to: SECTIONS.find((s) => s.kind === 'part' && s.chapter === c.n)?.id ?? '',
}));

type R = { l: number; t: number; r: number; b: number };
const hits = (a: R, b: R) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const inside = (a: R, b: R) => a.l >= b.l && a.t >= b.t && a.r <= b.r && a.b <= b.b;

export function Hero({ s, index }: { s: SectionData; index: number }) {
  const textRef = useRef<HTMLDivElement>(null);
  const buzzRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLParagraphElement>(null);
  const [first, second] = s.title.split(/ (?=to )/);

  useEffect(() => {
    const text = textRef.current!;
    const buzz = buzzRef.current!;
    const cue = cueRef.current!;
    const chips = [...buzz.querySelectorAll<HTMLElement>('.buzz__w')];
    let pos: [number, number][] = chips.map(() => [0, 0]);
    let shown: boolean[] = chips.map(() => false);
    let size: [number, number][] = [];
    let centre: [number, number] = [0, 0];
    /** the free area the stickers live in (the burst's overshoot is clamped to it) */
    let bounds: R = { l: 0, t: 0, r: 0, b: 0 };
    let ready = false;
    /** the cell size the band was fitted with (the grid changes with it) */
    let fitted = 0;

    const measure = () => {
      const W = buzz.clientWidth;
      const H = buzz.clientHeight;
      if (!W || !H) return;
      const mobile = ticker.frame.mobile;
      const cell = mobile ? BASE_CELL_MOBILE : BASE_CELL_DESKTOP;
      fitted = cell;
      // the headline's resting box: .hero2 is centred by translate(-50%, -50%); layout offsets ignore
      // the intro's slide-up transition, so the band never frames a half-moved headline
      const tw = text.offsetWidth;
      const th = text.offsetHeight;
      const tl = text.offsetLeft - buzz.offsetLeft - tw / 2;
      const tt = text.offsetTop - buzz.offsetTop - th / 2;
      const hole: R = { l: tl - PAD, t: tt - PAD, r: tl + tw + PAD, b: tt + th + PAD };
      heroHole.x = hole.l / W;
      heroHole.y = hole.t / H;
      heroHole.w = (hole.r - hole.l) / W;
      heroHole.h = (hole.b - hole.t) / H;
      centre = [(hole.l + hole.r) / 2, (hole.t + hole.b) / 2];
      size = chips.map((c) => [c.offsetWidth, c.offsetHeight]);

      // the free area: below the top bar, left of the rail (desktop), above the scroll cue
      const area: R = { l: 10, t: TOP_BAR, r: W - (mobile ? 10 : RAIL), b: H - CUE };

      // the frame band: as many rings as fit inside the free area and the art box (the canvas clips to it)
      const { cols, rows, offX, offY } = grid(W, H, cell);
      const [ax, ay, aw, ah] = artRect(W, H, mobile, 'center');
      const fit: R = { l: Math.max(area.l, ax), t: Math.max(area.t, ay), r: Math.min(area.r, ax + aw), b: Math.min(area.b, ay + ah) };
      const ringPx = (i: number): R => {
        const [x0, y0, x1, y1] = heroRing(i, cols, rows);
        return { l: offX + x0 * cell, t: offY + y0 * cell, r: offX + x1 * cell, b: offY + y1 * cell };
      };
      let n = HERO_RINGS.length;
      while (n > 0 && !inside(ringPx(n - 1), fit)) n--;
      const band = n > 0 ? ringPx(n - 1) : hole;
      heroHole.rings = n;
      heroHole.room = n > 0 ? Math.max(0, Math.floor(Math.min(band.l - fit.l, band.t - fit.t, fit.r - band.r, fit.b - band.b) / cell)) : 0;
      const block: R = { l: band.l - PAD, t: band.t - PAD, r: band.r + PAD, b: band.b + PAD };

      // the scroll cue (centred by translateX(-50%)) keeps a little air too
      const cl = cue.offsetLeft - buzz.offsetLeft - cue.offsetWidth / 2;
      const ct = cue.offsetTop - buzz.offsetTop;
      const blocks: R[] = [block, { l: cl - PAD, t: ct - PAD, r: cl + cue.offsetWidth + PAD, b: ct + cue.offsetHeight + PAD }];
      const top = area.t + FLOAT;
      bounds = { l: area.l, t: top, r: area.r, b: area.b };
      pos = chips.map(() => [0, 0]);
      shown = chips.map(() => false);
      for (let i = 0; i < chips.length; i++) {
        const [w, h] = size[i];
        let best: [number, number] | null = null;
        let bestScore = -1;
        for (let k = 0; k < TRIES; k++) {
          const x = area.l + w / 2 + hash2(i, k, 401) * (area.r - area.l - w);
          const y = top + h / 2 + hash2(i, k, 409) * (area.b - top - h);
          const box: R = { l: x - w / 2 - PAD / 2, t: y - h / 2 - PAD / 2, r: x + w / 2 + PAD / 2, b: y + h / 2 + PAD / 2 };
          if (blocks.some((bl) => hits(box, bl))) continue;
          // farthest from everything already placed (and from the band) → an even scatter
          let score = Infinity;
          for (let j = 0; j < i; j++) {
            if (!shown[j]) continue;
            score = Math.min(score, Math.hypot(x - pos[j][0], y - pos[j][1]));
          }
          const dx = Math.max(block.l - x, 0, x - block.r);
          const dy = Math.max(block.t - y, 0, y - block.b);
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
    // the stickers too: a late font swap resizes them without touching the headline
    chips.forEach((c) => ro.observe(c));
    document.fonts?.ready.then(measure);

    const off = ticker.onFrame((f) => {
      // crossing the mobile breakpoint changes the cell size, so the band must be refitted
      if ((f.mobile ? BASE_CELL_MOBILE : BASE_CELL_DESKTOP) !== fitted) measure();
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
        // the overshoot stays inside the free area: never over the HUD or the cue, never off screen
        const hw = size[i][0] / 2;
        const hh = size[i][1] / 2;
        x = Math.min(bounds.r - hw, Math.max(bounds.l + hw, x));
        y = Math.min(bounds.b - hh, Math.max(bounds.t + hh, y));
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
        {/* the headline and its chapter chips come first in the DOM (reading and Tab order);
            z-index keeps them above the stickers */}
        <div className="hero2" ref={textRef}>
          <p className="kicker kicker--center">{s.kicker}</p>
          <h1 className="hero__title">
            <span>{first}</span> <span>{second}</span>
          </h1>
          <p className="hero__lede">{s.lede}</p>
          <nav className="hero__chapters" aria-label={UI.heroChaptersLabel}>
            {CHAPTER_LINKS.map((c) => (
              <button
                key={c.n}
                type="button"
                className="hero__chapter"
                aria-label={UI.goToChapter(c.n, c.name)}
                title={UI.goToChapter(c.n, c.name)}
                onClick={() => ticker.scrollToSection(ticker.indexOf(c.to), 0)}
              >
                <b aria-hidden="true">{c.n}</b>
                {c.name}
              </button>
            ))}
          </nav>
        </div>
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
        <p className="hero__cue" aria-hidden="true" ref={cueRef}>
          {UI.scroll} <span>↓</span>
        </p>
      </div>
    </section>
  );
}
