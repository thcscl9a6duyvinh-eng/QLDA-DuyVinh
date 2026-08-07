const CACHE_NAME = 'qlda-app-shell-v1';
const INDEX_PATH = 'index.html';

function indexUrl(){
  return new URL(INDEX_PATH, self.registration.scope).toString();
}

async function cacheInitialIndex(){
  const cache = await caches.open(CACHE_NAME);
  const key = indexUrl();
  const existing = await cache.match(key, { ignoreSearch:true });
  if(existing) return;
  const res = await fetch(key + '?sw-install=' + Date.now(), { cache:'reload' });
  if(res && res.ok) await cache.put(key, res.clone());
}

async function serveCachedIndex(request){
  const cache = await caches.open(CACHE_NAME);
  const key = indexUrl();
  const cached = await cache.match(key, { ignoreSearch:true });
  if(cached) return cached;
  const res = await fetch(request);
  if(res && res.ok) await cache.put(key, res.clone());
  return res;
}

async function updateCachedIndex(version){
  const cache = await caches.open(CACHE_NAME);
  const key = indexUrl();
  const freshUrl = key + '?manual-update=' + encodeURIComponent(version || '') + '&_=' + Date.now();
  const res = await fetch(freshUrl, { cache:'reload' });
  if(!res || !res.ok) throw new Error('Không tải được index.html mới');
  await cache.put(key, res.clone());
}

self.addEventListener('install', event=>{
  self.skipWaiting();
  event.waitUntil(cacheInitialIndex());
});

self.addEventListener('activate', event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event=>{
  const req = event.request;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  const isIndexRequest = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if(!isIndexRequest) return;
  event.respondWith(serveCachedIndex(req));
});

self.addEventListener('message', event=>{
  const data = event.data || {};
  if(data.type !== 'CACHE_APP_VERSION') return;
  const port = event.ports && event.ports[0];
  event.waitUntil(
    updateCachedIndex(data.version)
      .then(()=>{ if(port) port.postMessage({ ok:true, version:data.version || '' }); })
      .catch(error=>{ if(port) port.postMessage({ ok:false, error:error && error.message ? error.message : 'update_failed' }); })
  );
});
