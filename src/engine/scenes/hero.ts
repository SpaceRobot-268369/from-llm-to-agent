/**
 * hero — the model in many boxes. Concentric pixel boxes around one blinking
 * core; scrolling peels them off outward until only the core is left.
 */
import { easeInOut, range } from '../noise';
import type { Scene } from './types';
import { blink, nestedBoxes } from './helpers';

const COUNT = 11;

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const peel = easeInOut(range(0.3, 1, p));
    nestedBoxes(g, box, {
      count: COUNT,
      spread: 1 + 0.015 * Math.sin(t * 1.3),
      keep: COUNT * (1 - range(0.4, 1, p)),
      outward: peel * 1.6,
      cursorOn: blink(t),
      coreAccent: false,
    });
    r.commit();
  },
};

export default scene;
