// Registers the service worker and keeps a signed list of mirrors fresh.
// The list is signed offline with an Ed25519 key; the browser only trusts
// lists that verify against the public key embedded in the page.
(() => {
  const me = document.currentScript;
  const root = me.dataset.root;            // relative path to site root
  const pubkey = me.dataset.pubkey;
  const KEY = "mirrors.v1";
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };

  async function verify(doc) {
    if (!pubkey || !doc || !doc.payload || !doc.sig) return null;
    try {
      const key = await crypto.subtle.importKey("spki", b64(pubkey), { name: "Ed25519" }, false, ["verify"]);
      const ok = await crypto.subtle.verify("Ed25519", key, b64(doc.sig), new TextEncoder().encode(doc.payload));
      return ok ? JSON.parse(doc.payload) : null;
    } catch { return null; }
  }

  async function fetchList(base) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(new URL("mirrors.json", base), { signal: ctl.signal, cache: "no-store" });
      return r.ok ? await verify(await r.json()) : null;
    } catch { return null; } finally { clearTimeout(t); }
  }

  async function refresh() {
    let cur = load();
    const bases = [new URL(root, location.href).href, ...((cur && cur.mirrors) || []).map((m) => m.url + "/")];
    for (const b of bases) {
      const l = await fetchList(b);
      if (l && (!cur || l.seq > cur.seq)) { cur = l; localStorage.setItem(KEY, JSON.stringify(l)); }
      if (l) break;
    }
    return cur;
  }

  function render(list) {
    const ul = document.getElementById("mirror-list");
    const mirrors = (list && list.mirrors) || [];
    if (ul) {
      ul.replaceChildren(...(mirrors.length ? mirrors : [{ none: true }]).map((m) => {
        const li = document.createElement("li");
        if (m.none) { li.textContent = me.dataset.msgNone; return li; }
        const a = document.createElement("a");
        a.href = m.url; a.textContent = m.url; a.rel = "noopener noreferrer";
        li.append(a, ` (${m.type})`);
        return li;
      }));
    }
    return mirrors;
  }

  function banner(mirrors) {
    const el = document.getElementById("banner");
    el.textContent = me.dataset.msgOffline + " ";
    if (mirrors.length) {
      el.append(me.dataset.msgTry);
      mirrors.forEach((m) => {
        const a = document.createElement("a");
        a.href = m.url + location.pathname.replace(/^.*?(\/(pt|en)\/.*)?$/, "$1");
        a.textContent = new URL(m.url).host || m.url;
        el.append(a);
      });
    }
    el.hidden = false;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(new URL("sw.js", new URL(root, location.href))).catch(() => {});
  }

  const cached = load();
  render(cached);
  refresh().then(render);

  const offline = () => banner((load() || {}).mirrors || []);
  window.addEventListener("offline", offline);
  if (navigator.onLine === false || new URLSearchParams(location.search).has("offline")) offline();
  window.addEventListener("online", () => { document.getElementById("banner").hidden = true; });
  // SW tells us when it served a cached page because the network failed.
  navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data === "served-from-cache") offline();
  });
})();
