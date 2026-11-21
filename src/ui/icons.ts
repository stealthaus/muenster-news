import { svg } from './dom';

/** Line icons drawn for this app on a 24px grid, stroke follows currentColor. */
const PATHS = {
  bookmark: '<path d="M6 3.5h12v17l-6-4.5-6 4.5z"/>',
  bookmarkFilled: '<path d="M6 3.5h12v17l-6-4.5-6 4.5z" fill="currentColor"/>',
  check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
  checkAll: '<path d="M2 12.5l4 4L14 8M10.5 16l.5.5L21.5 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
  stack: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M6.5 6h11M9 3h6"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  cloudOff: '<path d="M7 18h10.5a3.5 3.5 0 0 0 .7-6.9A6 6 0 0 0 7.2 9.1 4.5 4.5 0 0 0 7 18zM3 3l18 18"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 20): SVGSVGElement {
  return svg(
    `<svg class="icon icon-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`,
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
