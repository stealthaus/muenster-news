# Münster News – Spezifikation

Persönliche PWA auf GitHub Pages, die lokale Nachrichten aus mehreren Quellen sammelt.
Start mit dem Newsticker von Antenne Münster. Stand der Entscheidungen: 21.11.2026.

## Daten

- Der Ticker ist eine einzige Artikelseite (`/artikel/der-antenne-muenster-newsticker-<id>`), die laufend ergänzt wird.
  Die aktuelle URL wird über die Startseite gefunden, die zuletzt bekannte dient als Rückfall.
- Die Seite sendet keinen CORS-Header. Deshalb holt eine **GitHub Action** den Ticker, wandelt ihn in
  `data/news.json` um und veröffentlicht sie mit der App. Die App liest nur diese Datei.
- Abruf **Mo–Fr 6:30–19:00 Uhr (Europe/Berlin) alle 45 Minuten**. Repo öffentlich, Actions kostenlos.
- Die Action führt die neue Abholung mit der zuletzt veröffentlichten `news.json` zusammen, damit Tage erhalten bleiben,
  falls der Sender die Seite leert. Aufbewahrt werden die letzten 10 Tage. Meldungstexte landen nicht in der Git-Historie.
- Datenformat ist quellenoffen: jede Meldung hat `source`. Geplante Quellen: Westfälische Nachrichten (Lokalteil),
  Stadt Münster (Pressemitteilungen), Polizei Münster (Presseportal), SC Preußen Münster.

## Feed („Neu“)

- Zeigt die **letzten 3 Tage mit Meldungen** (am Wochenende also Mi–Fr), nur ungelesene, neueste zuerst.
- Senkrechtes Scrollen durch Karten. Tages-Reiter oben mit Zahl der ungelesenen Meldungen springen zum Tag.
- **Gelesen durch Verweilen:** Liegt die Mitte einer Karte in der Lesezone, läuft eine Zeit nach Textlänge
  (ca. 1 s pro 15 Wörter, mind. 2 s, max. 8 s; bei eingeklappter Karte zählt nur der sichtbare Teil).
  Die Lesezone ist ein Streifen über 45 % des Bereichs zwischen Tagesleiste und unterer Leiste, leicht nach oben
  versetzt (um 35 % des Platzes, der darüber und darunter frei bleibt; auf dem iPhone etwa y 182–494).
  Karten, die höher als die Lesezone sind, zählen, solange sie sie ganz ausfüllen. Verlässt die Karte die Zone, beginnt die Zeit neu.
  Danach leuchtet der Rahmen kurz auf, die Karte wird blasser (im Dark Mode deutlich stärker) und gilt als gelesen. Sie bleibt bis zum nächsten Öffnen stehen.
- **Wischen nach links** = gelesen (Karte verschwindet, kurz „Rückgängig“).
- **Wischen nach rechts** = merken (Karte wandert ins Merkfach und gilt als gelesen, kurz „Rückgängig“).
- **Alle gelesen pro Tag** am Tages-Reiter, mit Rückgängig.
- Ganz unten: Button **„Bereits gelesene Meldungen anzeigen“**, danach geht es mit den gelesenen der 3 Tage weiter.
- **Zurücksetzen:** Button „Alles wieder als ungelesen zeigen“ unten im Feed und im Themen-Blatt. Holt alle gelesenen und
  weggewischten Meldungen als ungelesen zurück, mit Rückgängig. Gemerkte bleiben im Merkfach.
- Text: Volltext mit Bild und Bildunterschrift. Karten zeigen eingeklappt **bis zu 15 Zeilen**, längere klappen per Tippen auf.
- **Themen** werden per Stichwortliste erkannt (Verkehr, Polizei, Sport, Stadt, Freizeit, Kultur, Wetter, Sonstiges),
  stehen als Label auf der Karte und lassen sich filtern (ausgeblendete Themen merkt sich die App).
- **Geänderte Meldungen:** Kommt zu einer gelesenen Meldung deutlich Text dazu (mind. 40 % und 120 Zeichen),
  erscheint sie wieder als ungelesen mit Hinweis „aktualisiert“. Kleine Korrekturen bleiben gelesen.
- Hinweise ohne Uhrzeit (z. B. „Schönes Wochenende“) werden nicht als Meldung gezeigt.

## Merkfach („Gemerkt“)

- Eigene Liste, umschaltbar über die untere Leiste (Neu · n / Gemerkt · n).
- Gespeicherte Meldungen werden **komplett lokal kopiert** (Text, Bild-Link, Quelle).
- Sie verschwinden **14 Tage nach dem Speichern**, außer sie sind per **Schloss** festgepinnt (Schloss erneut tippen löst).
- Jede nicht gepinnte Meldung zeigt die **Restzeit** („noch 3 Tage“) mit kleinem Balken, kurz vor Ablauf in Akzentfarbe.
- Meldungen lassen sich **selbst löschen** (mit Rückgängig).

## Technik

- Vite + TypeScript ohne Framework, Deploy per GitHub Actions auf Pages (wie `weather-app`).
- Alles Persönliche liegt im **localStorage** (gelesen, gemerkt, Filter). Kein Server, kein Konto.
- **Offline:** Service Worker hält App-Hülle und die letzte `news.json` vor, die App zeigt „Stand von …“.
- Zielgerät iPhone (Home-Bildschirm, Safe Areas, Wischgesten), Hell/Dunkel automatisch nach System.
- Keine Emojis, alle Symbole als eigene SVGs.
- Tests mit Vitest (Logik) und jsdom (Oberfläche) für jede Funktion.

## Design: Giebel in Grünspan

- Kopf: detaillierte Prinzipalmarkt-Silhouette (Treppen- und Volutengiebel, Rathausgiebel mit Fialen und Maßwerk,
  Bogengänge, Lamberti-Turm mit den drei Käfigen). Titel steht über den Dächern, verdeckt keine Häuser.
- Farben: Kupfergrün, Kalkweiß, warmer Sandstein. Nachtfassung dunkelgrün mit erleuchteten Fenstern.
- Name auf dem Home-Bildschirm: **Münster News**.
