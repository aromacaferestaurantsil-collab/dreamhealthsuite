const CACHE_NAME = 'healthbuddy-shell-v2';
const BASE = new URL(self.registration.scope).pathname;
const APP_SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'offline.html', BASE + 'icons/healthbuddy-192.svg', BASE + 'icons/healthbuddy-512.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.includes('/auth/') || url.pathname.includes('/rest/') || url.pathname.includes('/storage/') || url.pathname.includes('/functions/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(BASE+'index.html',copy)); }
      return response;
    }).catch(async()=> (await caches.match(BASE+'index.html')) || (await caches.match(BASE+'offline.html'))));
    return;
  }
  if (url.pathname.includes('/assets/')) event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
    return response;
  })));
});
