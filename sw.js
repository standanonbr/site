// Generated into dist/sw.js by scripts/finalize.mjs. Do not edit the output.
const VERSION = "v-e4ac5ff1ff31";
const FILES = [".nojekyll","_headers","assets/app.js","assets/redirect.js","assets/style.css","en/index.html","en/mirrors/index.html","en/posts/first-post/index.html","icon.svg","index.html","manifest.webmanifest","pt/index.html","pt/mirrors/index.html","pt/posts/primeiro-texto/index.html","en/","en/mirrors/","en/posts/first-post/","./","pt/","pt/mirrors/","pt/posts/primeiro-texto/"];
const SCOPE = self.registration.scope;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FILES.map((f) => new URL(f, SCOPE).href)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    // Network first (fresh posts), fall back to the saved copy when blocked.
    e.respondWith((async () => {
      try {
        const res = await Promise.race([fetch(req), timeout(5000)]);
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      } catch {
        const hit = (await caches.match(req)) || (await caches.match(new URL("index.html", SCOPE)));
        const cs = await self.clients.matchAll();
        cs.forEach((c) => c.postMessage("served-from-cache"));
        return hit || Response.error();
      }
    })());
    return;
  }
  // Assets: cache first.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
