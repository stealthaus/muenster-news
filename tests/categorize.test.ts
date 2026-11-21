import { describe, expect, it } from 'vitest';
import { categorize } from '../src/core/categorize';

describe('categorize', () => {
  it.each([
    ['Verkehrsunfallflucht auf der Südstraße', 'Hinweise nimmt die Polizei entgegen.', 'polizei'],
    ['Kanalpromenade gesperrt', 'Eine Umleitung ist eingerichtet.', 'verkehr'],
    ['SCP will bei Hoffenheim gewinnen', 'Anstoß ist um 14 Uhr.', 'sport'],
    ['Uni-Baskets vor Auswärts-Wochenende', 'Hochball ist um 18 Uhr.', 'sport'],
    ['Neue Attraktion im Zoo', 'Im Allwetterzoo gibt es Dinosaurier.', 'freizeit'],
    ['Neue Ausstellung im LWL-Museum', 'Kunst aus fünf Jahrhunderten.', 'kultur'],
    ['Glätte am Morgen', 'Der DWD warnt vor Frost.', 'wetter'],
    ['Rat beschließt Haushalt', 'Die Politik ist sich einig.', 'stadt'],
    ['Stammzellspende gesucht', 'Eine Typisierungsaktion findet statt.', 'sonstiges'],
  ])('%s → %s', (title, body, expected) => {
    expect(categorize(title, body)).toBe(expected);
  });

  it('weights the title more than the body', () => {
    expect(categorize('Konzert im Theater', 'Der Bus fährt bis zur Haltestelle, Umleitung wegen Baustelle.')).toBe('kultur');
  });

  it('matches whole words for short stems', () => {
    expect(categorize('Rathaus bekommt neues Dach', '')).toBe('sonstiges');
    expect(categorize('Stauden für den Garten', '')).toBe('sonstiges');
    expect(categorize('Der Rat tagt', '')).toBe('stadt');
  });

  it('matches stems at word starts including umlauts', () => {
    expect(categorize('Ärger über Brückensperrung', '')).toBe('verkehr');
    expect(categorize('Über die Ermittlungen', '')).toBe('polizei');
  });

  it('breaks ties by priority', () => {
    expect(categorize('Polizei und Verkehr', '')).toBe('polizei');
  });
});
