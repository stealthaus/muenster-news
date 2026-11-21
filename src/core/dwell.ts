/** Words that fit into the collapsed card (15 lines at phone width). */
export const COLLAPSED_WORDS = 170;
/**
 * Cards longer than this many characters (or with an image) start collapsed to 15 lines. That is a little under 15 lines
 * on a narrow phone; in the browser the card then measures itself and opens up again when the text fits after all.
 */
export const COLLAPSE_CHARS = 600;

export const DWELL_MIN_MS = 2000;
export const DWELL_MAX_MS = 8000;
const WORDS_PER_SECOND = 15;

/** How long a card has to stay in view to count as read: about one second per 15 words, within 2–8 seconds. */
export function dwellMs(words: number): number {
  const ms = Math.round((words / WORDS_PER_SECOND) * 1000);
  return Math.min(DWELL_MAX_MS, Math.max(DWELL_MIN_MS, ms));
}

/** Words the reader can see: title plus body, capped while the card is collapsed. */
export function visibleWords(titleWords: number, bodyWords: number, collapsed: boolean): number {
  return titleWords + (collapsed ? Math.min(bodyWords, COLLAPSED_WORDS) : bodyWords);
}
