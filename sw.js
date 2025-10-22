// SW v182 – cache bump
const CACHE='smenarek-cache-v182';
const ASSETS=['./','./index.html','./app_v182.js?v=182','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./backgrounds/bg_12h.jpg','./backgrounds/bg_8h.jpg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  const critical = u.pathname.endsWith('/app_v182.js') || u.pathname.endsWith('/index.html');
  if(critical){
    e.respondWith(fetch(e.request).then(res=>{const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return res;}).catch(()=>caches.match(e.request)));
  }else{
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});
