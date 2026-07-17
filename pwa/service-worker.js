/* =====================================================================
   Service worker - Tabellone Baskin EISI
   Cache-first per il funzionamento completamente offline.

   Se l'app è aperta nel browser normale (non installata), app.js chiede
   l'attivazione immediata di una nuova versione trovata tramite il
   messaggio SKIP_WAITING qui sotto, poi ricarica la pagina.

   Se l'app è installata come PWA (standalone), app.js NON invia questo
   messaggio: il service worker resta quello installato finché l'utente
   non disinstalla e reinstalla l'app (vedi "Verifica aggiornamenti" nelle
   impostazioni), per non interrompere una partita con un reload a sorpresa.

   Aggiornare CACHE_NAME ad ogni rilascio: serve sia a invalidare la vecchia
   cache sia a far dichiarare al file la propria versione.
   ===================================================================== */
const CACHE_NAME = 'tabellone-baskin-eisi-v1.17.7';

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

/* messaggio dalla pagina (solo se non installata come PWA): attiva subito
   la nuova versione in attesa */
self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING'){ self.skipWaiting(); }
});

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
    ).then(()=> self.clients.claim())
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
