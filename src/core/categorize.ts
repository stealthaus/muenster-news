import type { Category } from './types';

/**
 * Word stems per topic. A stem matches at the start of a word, so "sperr" finds "Sperrung" and "gesperrt" needs its
 * own entry. A trailing space means whole word only ("rat " finds "Rat" but not "Rathaus").
 */
const KEYWORDS: Record<Exclude<Category, 'sonstiges'>, string[]> = {
  polizei: [
    'polizei', 'unfallflucht', 'verkehrsunfallflucht', 'festgenommen', 'festnahme', 'einbruch', 'eingebrochen', 'diebstahl', 'gestohlen',
    'zeugen', 'täter', 'tatverdächtig', 'ermittl', 'staatsanwalt', 'gericht', 'prozess', 'angeklagt', 'betrug',
    'betrüger', 'überfall', 'feuerwehr', 'brand', 'rettungsdienst', 'verletzt', 'kontrolle',
  ],
  verkehr: [
    'verkehr', 'sperrung', 'gesperrt', 'baustelle', 'umleitung', 'stau ', 'ampel', 'bus ', 'buslinie', 'bahn',
    'zug ', 'züge', 'radweg', 'fahrbahn', 'kreuzung', 'parken', 'parkhaus', 'brücke', 'autobahn', 'a1 ', 'a43 ',
    'b51 ', 'tempo', 'kanal', 'fahrrad', 'radfahr', 'unfall',
  ],
  sport: [
    'preußen', 'scp ', 'baskets', 'usc ', 'volleyball', 'fußball', 'basketball', 'handball', 'liga', 'tabelle',
    'trainer', 'anstoß', 'hochball', 'heimspiel', 'auswärts', 'sieg', 'niederlage', 'spieltag', 'marathon',
    'turnier', 'meisterschaft',
  ],
  stadt: [
    'stadt münster', 'stadtverwaltung', 'rat ', 'ratssitzung', 'oberbürgermeister', 'politik', 'haushalt',
    'stadtwerke', 'schule', 'kita', 'universität', 'uni ', 'wohnung', 'wohnungs', 'bürger', 'fernwärme',
    'bauprojekt', 'neubau', 'umfrage', 'klinik', 'krankenhaus', 'wohnplätze', 'cdu ', 'spd ', 'grüne ',
    'fdp ', 'partei', 'landtag', 'bundestag', 'ministerpräsident',
  ],
  freizeit: [
    'zoo', 'allwetterzoo', 'weihnachtsmarkt', 'send ', 'aasee', 'ausflug', 'attraktion', 'eröffnet', 'eröffnung',
    'schwimmbad', 'freibad', 'hallenbad', 'markt', 'fest ', 'feier', 'veranstaltung', 'wochenende',
  ],
  kultur: [
    'theater', 'konzert', 'ausstellung', 'museum', 'lwl', 'kunst', 'festival', 'lesung', 'musik', 'oper', 'kino',
    'bühne', 'kultur',
  ],
  wetter: [
    'wetter', 'regen', 'sturm', 'glätte', 'glatteis', 'schnee', 'gewitter', 'hitze', 'temperatur', 'dwd',
    'unwetter', 'frost', 'nebel',
  ],
};

/** Ties go to the topic listed first. */
const PRIORITY: Exclude<Category, 'sonstiges'>[] = ['polizei', 'verkehr', 'sport', 'wetter', 'kultur', 'freizeit', 'stadt'];

const PATTERNS = Object.fromEntries(
  PRIORITY.map((cat) => [
    cat,
    KEYWORDS[cat].map((stem) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(stem.trimEnd())}${stem.endsWith(' ') ? '(?![\\p{L}])' : ''}`, 'giu')),
  ]),
) as Record<Exclude<Category, 'sonstiges'>, RegExp[]>;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function count(patterns: RegExp[], text: string): number {
  let n = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    n += text.match(re)?.length ?? 0;
  }
  return n;
}

/** Title hits weigh three times as much as body hits. */
export function categorize(title: string, body: string): Category {
  let best: Category = 'sonstiges';
  let bestScore = 0;
  for (const cat of PRIORITY) {
    const score = count(PATTERNS[cat], title) * 3 + count(PATTERNS[cat], body);
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}
