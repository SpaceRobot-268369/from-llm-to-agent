/**
 * Intro timing shared by the loader and the hero. The loader sets `at` (the
 * ticker clock, in seconds) when it finishes; the hero's stickers explode out
 * of the centre from that moment. -1 = still loading.
 */
export const intro = { at: -1 };

/** sticker burst: per-sticker stagger and flight time (seconds) */
export const BURST = { stagger: 0.45, flight: 0.9 };
