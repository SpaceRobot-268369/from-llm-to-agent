/**
 * unwrap — the finale. The hero's nested boxes return and collapse inward as
 * you scroll, outermost first, until only the blinking core is left: the next
 * token.
 */
import { easeInOut, range } from '../noise';
import type { Scene } from './types';
import { blink, nestedBoxes } from './helpers';

const COUNT = 11;

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const c = easeInOut(range(0.05, 0.75, p));
    nestedBoxes(g, box, {
      count: COUNT,
      spread: 1 - 0.8 * c,
      keep: COUNT * (1 - range(0.05, 0.8, p)),
      cursorOn: blink(t),
      coreAccent: p > 0.6,
    });
    r.commit();
  },
};

export default scene;
