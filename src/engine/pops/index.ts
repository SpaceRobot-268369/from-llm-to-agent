import type { Pop, PopCtx } from './types';
import boxCat from './box-cat';
import booGhost from './boo-ghost';
import starCrumble from './star-crumble';
import botAgent from './bot-agent';
import goldfish from './goldfish';
import cursorBoing from './cursor-boing';
import wrapItUp from './wrap-it-up';
import twinkle from './twinkle';

export type PopId =
  | 'box-cat'
  | 'boo-ghost'
  | 'star-crumble'
  | 'bot-agent'
  | 'goldfish'
  | 'cursor-boing'
  | 'wrap-it-up'
  | 'twinkle';

export const POPS: Record<PopId, Pop> = {
  'box-cat': boxCat,
  'boo-ghost': booGhost,
  'star-crumble': starCrumble,
  'bot-agent': botAgent,
  goldfish,
  'cursor-boing': cursorBoing,
  'wrap-it-up': wrapItUp,
  twinkle,
};

/** the regular pops, dealt from a shuffled deck */
export const DECK: PopId[] = ['box-cat', 'boo-ghost', 'star-crumble', 'bot-agent', 'goldfish', 'cursor-boing'];

/** the easter egg: rapid clicks in one spot wrap boxes around a sleeping core (never dealt) */
export const COMBO: PopId = 'wrap-it-up';

/** the small answer when no deck pop fits around the click (never dealt) */
export const FALLBACK: PopId = 'twinkle';

/**
 * Each chapter's own pop: the first click in a new chapter deals it first
 * (if it hasn't played yet this deck). boo-ghost and goldfish are wild cards.
 */
export const HOME: Record<PopCtx, PopId> = {
  hero: 'star-crumble',
  model: 'cursor-boing',
  memory: 'box-cat',
  harness: 'bot-agent',
  finale: 'bot-agent',
};
