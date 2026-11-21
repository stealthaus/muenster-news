// Writes the app icon SVGs (the Rathaus gable with pinnacles and arcades on verdigris) into public/icons/.
import { writeFileSync } from 'node:fs';

// Drawn on a 64 grid: the gable spans x 16..48 and y 6..54, the street starts at y 54.
const GABLE = 'M16 54V30l3-3v-8l3-3v9l4-4v-8l6-7 6 7v8l4 4v-9l3 3v8l3 3v24z';
const SHADE =
  'M20 54v-8a5 5 0 0 1 10 0v8zM34 54v-8a5 5 0 0 1 10 0v8zM29.5 38v-6a2.5 2.5 0 0 1 5 0v6z' +
  'M29.4 22a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z';

/** k: pixels per grid unit. 8 fills the icon; smaller keeps the gable inside the maskable safe zone. */
function icon(k, rounded) {
  const street = k === 8 ? 432 : 256 + 24 * k;
  const x = 256 - 32 * k;
  const y = street - 54 * k;
  const clip = rounded ? ' clip-path="url(#r)"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    (rounded ? `<defs><clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath></defs>` : '') +
    `<g${clip}><rect width="512" height="512" fill="#2f6b5c"/>` +
    `<rect y="${street}" width="512" height="${512 - street}" fill="#24574a"/>` +
    `<g transform="translate(${x} ${y}) scale(${k})"><path d="${GABLE}" fill="#e3d3b4"/><path d="${SHADE}" fill="#5e7f72"/></g>` +
    `</g></svg>\n`
  );
}

writeFileSync('public/icons/icon.svg', icon(8, true));
writeFileSync('public/icons/icon-full.svg', icon(8, false));
writeFileSync('public/icons/icon-maskable.svg', icon(6, false));
console.log('icons written');
