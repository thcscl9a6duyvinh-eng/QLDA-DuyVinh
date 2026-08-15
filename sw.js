const CACHE_NAME = 'thanhtra-manual-shell-v1';
const APPROVED_CACHE_PREFIX = 'thanhtra-approved-shell-';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME && key.startsWith('thanhtra-') && !key.startsWith(APPROVED_CACHE_PREFIX))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if(!event.data || event.data.type !== 'UPDATE_APP_SHELL') return;
  event.waitUntil((async () => {
    try{
      const cache = await caches.open(CACHE_NAME);
      const stamp = Date.now();
      const indexRes = await fetch('index.html?update=' + stamp, { cache:'no-store' });
      if(!indexRes.ok) throw new Error('Cannot fetch index.html');
      await cache.put('index.html', indexRes.clone());
      const versionRes = await fetch('version.json?update=' + stamp, { cache:'no-store' });
      if(versionRes.ok) await cache.put('version.json', versionRes.clone());
      if(event.source) event.source.postMessage({ type:'APP_SHELL_UPDATED' });
    }catch(error){
      if(event.source) event.source.postMessage({ type:'APP_SHELL_UPDATE_FAILED', message:error && error.message ? error.message : 'Update failed' });
    }
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const isVersion = url.pathname.endsWith('/version.json');
  if(isVersion){
    event.respondWith(fetch(req, { cache:'no-store' }).catch(() => caches.match('version.json')));
    return;
  }
  const isIndex = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const isManualUpdateFetch = isIndex && url.searchParams.has('update');
  if(isManualUpdateFetch){
    event.respondWith(fetch(req, { cache:'no-store' }));
    return;
  }
  if(req.mode === 'navigate' || isIndex){
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => cache.match('index.html'))
        .then(cached => cached || fetch(req, { cache:'no-store' }))
    );
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
