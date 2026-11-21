# Münster News

Persönliche PWA für lokale Nachrichten aus Münster. Zeigt die Meldungen der letzten drei Tage mit Meldungen,
nur was noch nicht gelesen ist. Merken für 14 Tage, mit Schloss dauerhaft. Alles Persönliche bleibt im localStorage.
Entscheidungen und Verhalten im Detail: [SPEC.md](SPEC.md).

## So funktioniert es

- Eine GitHub Action holt Mo–Fr von 6:30 bis 19 Uhr alle 45 Minuten den Newsticker von Antenne Münster,
  führt ihn mit dem zuletzt veröffentlichten Stand zusammen und veröffentlicht `data/news.json` mit der App auf GitHub Pages.
  Der Browser kann die Quelle nicht direkt laden (kein CORS).
- Die App liest nur diese Datei. Gelesen, gemerkt und Themenfilter liegen im localStorage des Geräts.

## Befehle

```bash
npm install
npm run fetch-news -- public/data/news.json   # echte Daten für die lokale Entwicklung
npm run dev                                   # http://localhost:5173
npm test                                      # Vitest, Logik und Oberfläche (jsdom)
npm run build
npm run icons                                 # App-Icons neu rendern (macOS, Pillow)
```

## Aufbau

- `src/core/` Logik ohne DOM: Typen, Themen-Erkennung, Zusammenführen, Speicher (gelesen, gemerkt, Ablauf), Feed
- `src/sources/` Parser je Quelle (nur in der Action, nicht im App-Bundle)
- `src/ui/` Oberfläche: Karten, Wischen, Verweilen, Merkfach, Filter, Prinzipalmarkt-Silhouette, eigene SVG-Symbole
- `scripts/` Abruf für die Action und Zeitplan-Gate (Winter- und Sommerzeit)
- `tests/` Tests für alles, `tests/fixtures/` nachgebaute Ticker-Seite ohne Originaltexte

## Neue Quelle anbinden

1. Parser in `src/sources/<quelle>.ts`, der `NewsItem[]` mit eigener `source`-Kennung liefert, plus Tests mit Fixture
2. `SourceId` und `SOURCE_NAMES` in `src/core/types.ts` erweitern
3. In `scripts/fetch-news.ts` abrufen; `mergeNews` behandelt jede Quelle getrennt
