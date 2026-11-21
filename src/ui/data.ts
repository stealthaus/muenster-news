import type { KeyValue } from '../core/store';
import type { NewsFile } from '../core/types';

export const DATA_URL = './data/news.json';
export const CACHE_KEY = 'muenster-news:last-file';

export interface LoadResult {
  file: NewsFile | null;
  /** True when the network failed and the last saved copy is shown. */
  offline: boolean;
}

function valid(data: unknown): data is NewsFile {
  return !!data && typeof data === 'object' && (data as NewsFile).version === 1 && Array.isArray((data as NewsFile).items);
}

/**
 * Loads news.json. The service worker already serves the last copy offline; the copy in storage is a second net for
 * browsers without a service worker (or a fresh install that has never been online with it).
 */
export async function loadNews(fetchFn: typeof fetch, kv: KeyValue | null, url = DATA_URL): Promise<LoadResult> {
  try {
    const res = await fetchFn(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!valid(data)) throw new Error('Ungültige Daten');
    try {
      kv?.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // Storage full: the service worker cache still has it.
    }
    // The service worker marks answers it took from its cache because the network failed.
    return { file: data, offline: res.headers.get('x-served-from') === 'cache' };
  } catch {
    try {
      const raw = kv?.getItem(CACHE_KEY);
      const data: unknown = raw ? JSON.parse(raw) : null;
      return { file: valid(data) ? data : null, offline: true };
    } catch {
      return { file: null, offline: true };
    }
  }
}
