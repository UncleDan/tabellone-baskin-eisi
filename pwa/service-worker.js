/* =====================================================================
   Service worker - Tabellone Baskin
   Cache-first per il funzionamento completamente offline.
   Nessun aggiornamento automatico: il service worker resta quello installato
   finché l'app non viene disinstallata e reinstallata (vedi "Verifica
   aggiornamenti" nelle impostazioni). Aggiornare comunque CACHE_NAME ad ogni
   rilascio, così il file dichiara sempre la propria versione.
   ===================================================================== */
const CACHE_NAME = 'baskin-tabellone-v1.16.3';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.webmanifest',
  './sounds/horn.wav',
  './sounds/whistle.wav',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/logos/logo-baskin.svg',
  './icons/logos/logo-eisi.svg'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if(req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        // memorizza in cache le richieste valide della stessa origine
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(()=>{
        // fallback: per le navigazioni, restituisci la pagina principale
        if(req.mode === 'navigate'){ return caches.match('./index.html'); }
      });
    })
  );
});
