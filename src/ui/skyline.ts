import { svg } from './dom';

/**
 * Prinzipalmarkt: stepped and scrolled gables, the Rathaus gable with pinnacles and tracery, arcades at street level,
 * and the Lamberti tower with its three cages behind. Colours come from CSS variables (--sky-far, --house-a, --house-b,
 * --house-shade, --window-lit), so light and dark mode only change the variables.
 */
const HOUSES = [
  // Treppengiebel
  'M0 120V60h4v-8h5v-8h5v-8h4v-8h10v8h4v8h5v8h5v8h4v60z',
  // Volutengiebel
  'M46 120V58c0-8 8-8 8-14s6-6 6-12l6-10 5-8 5 8 6 10c0 6 6 6 6 12s8 6 8 14v62z',
  // Rathaus mit Fialen
  'M96 120V48l4-4V30l4-4v18l6-6V20l4-4v18l9-28 9 28V16l4 4v18l6 6V26l4 4v14l4 4v72z',
  'M150 120V56h4v-6c0-6 6-6 6-12h4v-8c0-5 5-5 5-10l5-8 5 8c0 5 5 5 5 10v8h4c0 6 6 6 6 12v6h4v64z',
  'M198 120V62c0-7 7-7 7-13s5-5 5-11l7-14 6 14c0 6 5 6 5 11s7 6 7 13v58z',
  'M246 120V64h4v-7h5v-7h5v-7h4v-7h8v7h4v7h5v7h5v7h4v56z',
  'M294 120V60c0-6 6-6 6-12l6-12 6 12c0 6 8 6 8 12v60z',
];

const ARCADES =
  'M6 120v-14a8 8 0 0 1 16 0v14zM26 120v-14a8 8 0 0 1 16 0v14zM52 120v-14a9 9 0 0 1 18 0v14zM74 120v-14a9 9 0 0 1 18 0v14z' +
  'M100 120v-16a11 11 0 0 1 22 0v16zM124 120v-16a11 11 0 0 1 22 0v16zM155 120v-14a9 9 0 0 1 18 0v14zM176 120v-14a9 9 0 0 1 18 0v14z' +
  'M203 120v-14a9 9 0 0 1 18 0v14zM224 120v-14a8 8 0 0 1 16 0v14zM250 120v-14a9 9 0 0 1 18 0v14zM272 120v-14a9 9 0 0 1 18 0v14z' +
  'M298 120v-14a8 8 0 0 1 16 0v14z';

const WINDOWS =
  'M8 66h6v9H8zM20 66h6v9h-6zM32 66h6v9h-6zM19 40h8v8h-8zM8 78h6v6H8zM20 78h6v6h-6zM32 78h6v6h-6z' +
  'M56 64h6v9h-6zM68 64h6v9h-6zM80 64h6v9h-6zM64 42h12v8H64zM56 77h6v6h-6zM68 77h6v6h-6zM80 77h6v6h-6zM69 26h2v8h-2z' +
  'M158 64h6v9h-6zM171 64h6v9h-6zM184 64h6v9h-6zM168 40h12v8h-12zM158 77h6v6h-6zM171 77h6v6h-6zM184 77h6v6h-6z' +
  'M204 68h6v9h-6zM216 68h6v9h-6zM228 68h6v9h-6zM214 46h8v8h-8z' +
  'M252 70h6v9h-6zM265 70h6v9h-6zM278 70h6v9h-6zM263 46h10v8h-10zM300 66h6v9h-6zM312 66h6v9h-6zM303 50h6v6h-6z';

/** Rathaus: lancet windows, tracery band and the rose in the gable. */
const TRACERY =
  'M103 72V58a3.5 3.5 0 0 1 7 0v14zM119 72V44a4 4 0 0 1 8 0v28zM136 72V58a3.5 3.5 0 0 1 7 0v14z' +
  'M111 28a2 2 0 0 1 4 0v8h-4zM131 28a2 2 0 0 1 4 0v8h-4zM102 82h42v3h-42zM121 36l2-6 2 6z';

/** Lamberti tower and the three cages. */
const TOWER = 'M247 120V44h14v76zM248 44l6-40 6 40z';
const CAGES = 'M252 22h4v6h-4zM251.5 30h5v6h-5zM251 38h6v6h-6zM249 50h10v8h-10zM249 64a5 5 0 0 1 10 0v12h-10z';

/** Windows that glow at night. */
const LIT = 'M20 66h6v9h-6zM68 77h6v6h-6zM171 64h6v9h-6zM216 68h6v9h-6zM265 70h6v9h-6zM312 66h6v9h-6z';

export function skyline(): SVGSVGElement {
  const houses = HOUSES.map((d, i) => `<path class="house ${i % 2 ? 'house-b' : 'house-a'}" d="${d}"/>`).join('');
  return svg(
    `<svg class="skyline" viewBox="0 0 320 120" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Giebelhäuser am Prinzipalmarkt">` +
      `<path class="tower" d="${TOWER}"/><path class="shade" d="${CAGES}"/>${houses}` +
      `<path class="shade" d="${ARCADES}"/><path class="shade" d="${WINDOWS}"/><path class="shade" d="${TRACERY}"/>` +
      `<path class="shade" d="M0 88h320v2H0z"/><path class="lit" d="${LIT}"/><path class="lit lit-soft" d="M119 72V44a4 4 0 0 1 8 0v28z"/></svg>`,
  );
}
