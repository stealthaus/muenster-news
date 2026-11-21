import './style.css';
import { browserStorage, Store } from './core/store';
import { App } from './ui/app';

const kv = browserStorage();
const app = new App({ root: document.getElementById('app')!, store: new Store(kv), kv, fetch: (...a) => fetch(...a) });
void app.start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Without a service worker the app still works, just not offline.
  });
}
