// Sama origin (tkoljonen-wq.github.io) on jaettu muiden sovellusten kanssa,
// joten vanhoja välimuisteja poistetaan vain tämän sovelluksen etuliitteellä.
const CACHE_PREFIX = 'malaga-2026-';
const CACHE_NAME = CACHE_PREFIX + 'v18';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // cache: 'reload' ohittaa HTTP-välimuistin (GitHub Pages: max-age=600),
      // ettei esicacheen päädy vanhaa kopiota
      Promise.allSettled(ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: aina ensin verkosta, välimuisti vain offline-tilassa
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) return;

  const req = event.request;
  // cache: 'no-cache' = pakollinen tarkistus palvelimelta (ETag). Pelkkä fetch()
  // palauttaisi HTTP-välimuistista jopa 10 min vanhan kopion ilman verkkopyyntöä,
  // jolloin "network first" ei oikeasti hakisi tuoretta versiota.
  const network = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache' })
    : fetch(req, { cache: 'no-cache' });

  event.respondWith(
    network
      .then(response => {
        // Vain ehjät vastaukset välimuistiin — virhesivu tai uudelleenohjaus
        // ei saa korvata toimivaa kopiota
        if (response.ok && !response.redirected) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
