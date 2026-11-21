import { COLLAPSE_CHARS, visibleWords } from '../core/dwell';
import { CATEGORY_LABELS, textLength, wordCount, type NewsItem } from '../core/types';
import { h } from './dom';
import { icon } from './icons';
import { attachSwipe, wasJustDragged } from './swipe';

export interface CardOptions {
  updated?: boolean;
  read?: boolean;
  /** Left swipe marks read; off for cards that are read already. */
  allowLeft?: boolean;
  onSwipe?: (dir: 'left' | 'right') => void;
  onSave?: () => void;
  onToggle?: (expanded: boolean) => void;
}

export function isCollapsible(item: NewsItem): boolean {
  return textLength(item) > COLLAPSE_CHARS || !!item.image;
}

/** Words the reader sees in the card's current state, for the dwell timer. */
export function cardWords(item: NewsItem, expanded: boolean): number {
  return visibleWords(wordCount(item.title), wordCount(item.paragraphs.join(' ')), isCollapsible(item) && !expanded);
}

export function figure(item: NewsItem): HTMLElement | null {
  if (!item.image) return null;
  const { src, caption, credit } = item.image;
  return h(
    'figure',
    { class: 'card-img' },
    h('img', { src, alt: caption ?? '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' }),
    caption || credit
      ? h('figcaption', {}, caption ?? '', credit ? h('span', { class: 'credit' }, `${caption ? ' · ' : ''}© ${credit}`) : null)
      : null,
  );
}

export function renderCard(item: NewsItem, opts: CardOptions = {}): HTMLElement {
  const collapsible = isCollapsible(item);
  const card = h('article', {
    class: `card${opts.read ? ' is-read' : ''}${collapsible ? ' is-collapsed' : ''}`,
    'data-id': item.id,
    'data-category': item.category,
  });

  const under = h(
    'div',
    { class: 'card-under', 'aria-hidden': 'true' },
    h('span', { class: 'under-save' }, icon('bookmark', 18), 'merken'),
    h('span', { class: 'under-read' }, 'gelesen', icon('check', 18)),
  );

  const saveBtn = h('button', { class: 'icon-btn card-save', type: 'button', 'aria-label': 'Merken' }, icon('bookmark', 18));
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    opts.onSave?.();
  });

  const text = h('div', { class: 'card-text' }, ...item.paragraphs.map((p) => h('p', {}, p)));
  const fig = figure(item);
  const more = collapsible
    ? h('button', { class: 'card-more', type: 'button', 'aria-expanded': 'false' }, textLength(item) > COLLAPSE_CHARS ? 'weiterlesen' : 'Bild anzeigen')
    : null;

  const surface = h(
    'div',
    { class: 'card-surface' },
    h(
      'div',
      { class: 'card-meta' },
      h('span', { class: 'card-label' }, `${CATEGORY_LABELS[item.category].toUpperCase()} · ${item.time}`),
      opts.updated ? h('span', { class: 'badge-updated' }, 'aktualisiert') : null,
      saveBtn,
    ),
    h('h3', { class: 'card-title' }, item.title),
    text,
    fig,
    more,
  );

  let canToggle = collapsible;
  const toggle = () => {
    if (!canToggle) return;
    const expanded = card.classList.toggle('is-expanded');
    card.classList.toggle('is-collapsed', !expanded);
    if (more) {
      more.setAttribute('aria-expanded', String(expanded));
      more.textContent = expanded ? 'weniger' : textLength(item) > COLLAPSE_CHARS ? 'weiterlesen' : 'Bild anzeigen';
    }
    opts.onToggle?.(expanded);
  };
  surface.addEventListener('click', (e) => {
    if (wasJustDragged(card)) return;
    if ((e.target as Element).closest('a')) return;
    toggle();
  });

  card.append(under, surface);

  // The 7-line clamp is a guess from the character count; once laid out, open cards whose text fits anyway.
  if (collapsible && !item.image) {
    const fit = () => {
      if (!card.classList.contains('is-collapsed') || text.clientHeight === 0) return;
      if (text.scrollHeight <= text.clientHeight + 1) {
        canToggle = false;
        card.classList.remove('is-collapsed');
        more?.remove();
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fit);
  }

  if (opts.onSwipe) {
    attachSwipe(card, surface, { allowLeft: opts.allowLeft !== false, allowRight: true, onSwipe: opts.onSwipe });
  }
  return card;
}
