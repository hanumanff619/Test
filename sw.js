self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(
    caches.open('smenarek-v2').then(c=>c.addAll([
      './','./index.html','./app_v2.0.js','./manifest.json',
      './icons/icon-192.png','./icons/icon-512.png',
      './backgrounds/bg_12h.jpg','./backgrounds/bg_8h.jpg'
    ]))
  );
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
