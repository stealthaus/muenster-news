// Writes the app icon SVGs (three Prinzipalmarkt gables on verdigris) into public/icons/.
import { writeFileSync } from 'node:fs';

const HOUSES = [
  ['M0 120V60h4v-8h5v-8h5v-8h4v-8h10v8h4v8h5v8h5v8h4v60z', '#e3d3b4'],
  ['M46 120V58c0-8 8-8 8-14s6-6 6-12l6-10 5-8 5 8 6 10c0 6 6 6 6 12s8 6 8 14v62z', '#d6c29c'],
  ['M96 120V48l4-4V30l4-4v18l6-6V20l4-4v18l9-28 9 28V16l4 4v18l6 6V26l4 4v14l4 4v72z', '#e3d3b4'],
];
const SHADE =
  'M6 120v-14a8 8 0 0 1 16 0v14zM26 120v-14a8 8 0 0 1 16 0v14zM52 120v-14a9 9 0 0 1 18 0v14zM74 120v-14a9 9 0 0 1 18 0v14z' +
  'M100 120v-16a11 11 0 0 1 22 0v16zM124 120v-16a11 11 0 0 1 22 0v16z' +
  'M8 66h6v9H8zM20 66h6v9h-6zM32 66h6v9h-6zM19 40h8v8h-8zM56 64h6v9h-6zM68 64h6v9h-6zM80 64h6v9h-6zM64 42h12v8H64z' +
  'M103 72V58a3.5 3.5 0 0 1 7 0v14zM119 72V44a4 4 0 0 1 8 0v28zM136 72V58a3.5 3.5 0 0 1 7 0v14zM102 82h42v3h-42zM0 88h150v2H0z';

function icon(scale, rounded) {
  const w = 150 * scale;
  const hgt = 120 * scale;
  const x = (512 - w) / 2;
  const y = 512 - hgt - (512 - hgt) * 0.42;
  const houses = HOUSES.map(([d, c]) => `<path d="${d}" fill="${c}"/>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#2f6b5c"/>` +
    `<rect y="${y + hgt}" width="512" height="${512 - y - hgt}" ${rounded ? 'rx="0"' : ''} fill="#24574a"/>` +
    `<g transform="translate(${x} ${y}) scale(${scale})">${houses}<path d="${SHADE}" fill="#5e7f72"/></g>` +
    `</svg>\n`
  );
}

writeFileSync('public/icons/icon.svg', icon(2.5, true));
writeFileSync('public/icons/icon-full.svg', icon(2.5, false));
writeFileSync('public/icons/icon-maskable.svg', icon(1.9, false));
console.log('icons written');
