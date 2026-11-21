/**
 * Fetches all sources, merges them with the last published news.json and writes the result.
 * Usage: tsx scripts/fetch-news.ts <out-file> [previous-url]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mergeNews } from '../src/core/merge';
import type { NewsFile, NewsItem } from '../src/core/types';
import { ANTENNE_FALLBACK_TICKER, ANTENNE_ORIGIN, berlinDate, findTickerUrl, parseAntenneTicker } from '../src/sources/antenne';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const HEADERS = { 'User-Agent': 'muenster-news-pwa (personal news reader)', Accept: 'text/html,application/json' };

async function getText(fetchFn: Fetch, url: string): Promise<string> {
  const res = await fetchFn(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Last published file, or null when there is none yet or it cannot be read. */
export async function loadPrevious(fetchFn: Fetch, url: string | undefined): Promise<NewsFile | null> {
  if (!url) return null;
  try {
    const res = await fetchFn(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = (await res.json()) as NewsFile;
    return data?.version === 1 && Array.isArray(data.items) ? data : null;
  } catch {
    return null;
  }
}

export interface RunResult {
  file: NewsFile;
  /** Sources that failed this run; their previous items are kept. */
  errors: string[];
}

export async function run(fetchFn: Fetch, now: Date, previousUrl?: string): Promise<RunResult> {
  const previous = await loadPrevious(fetchFn, previousUrl);
  const errors: string[] = [];
  let fresh: NewsItem[] = [];
  const sources: NewsFile['sources'] = { ...(previous?.sources ?? {}) };

  try {
    let tickerUrl = ANTENNE_FALLBACK_TICKER;
    try {
      tickerUrl = findTickerUrl(await getText(fetchFn, ANTENNE_ORIGIN + '/')) ?? tickerUrl;
    } catch {
      // Homepage down: try the last known ticker article.
      tickerUrl = previous?.sources.antenne?.url ?? tickerUrl;
    }
    const items = parseAntenneTicker(await getText(fetchFn, tickerUrl), tickerUrl, now);
    if (items.length === 0) throw new Error('Antenne: keine Meldungen gefunden');
    fresh = fresh.concat(items);
    sources.antenne = { name: 'Antenne Münster', url: tickerUrl, fetchedAt: now.toISOString() };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const items = mergeNews(previous?.items ?? [], fresh, berlinDate(now));
  return { file: { version: 1, generatedAt: now.toISOString(), sources, items }, errors };
}

async function main(): Promise<void> {
  const [out, previousUrl] = process.argv.slice(2);
  if (!out) throw new Error('Usage: tsx scripts/fetch-news.ts <out-file> [previous-url]');
  const { file, errors } = await run(fetch, new Date(), previousUrl);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file));
  console.log(`${file.items.length} Meldungen geschrieben nach ${out}`);
  for (const e of errors) console.warn(`Warnung: ${e}`);
  // Fail only when nothing at all can be published.
  if (file.items.length === 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
