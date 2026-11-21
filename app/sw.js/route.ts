import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The service worker that makes the installed app work offline. Built once per deploy: the
 * build id names the caches (a new deploy replaces the old pages and scripts), and the card
 * list is read from `public/cards` (every card image is saved on install).
 *
 * Card images are saved through the image optimizer at one width (a few MB in all); offline,
 * a card at any other width is answered with the saved copy. Card files are never edited in
 * place: a changed face gets a new file name (e.g. `profectus-v2.png`), so caches never go stale.
 */
export const dynamic = "force-static";

/** Pages the installed app can open offline. `/play` (and `/learn/play`) is the same page for every game (lesson). */
const PAGES = ["/", "/play", "/online", "/learn", "/learn/play"];
/** One saved width per card: sharp enough for the board and the zoomed view. */
const CARD_WIDTH = 640;
const CARD_QUALITY = 75;

function cardFiles(): string[] {
  const root = join(process.cwd(), "public");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(png|jpe?g|webp)$/i.test(entry.name) ? [join(dir, entry.name)] : [],
    );
  return walk(join(root, "cards"))
    .map((file) => `/${relative(root, file).split("\\").join("/")}`)
    .sort();
}

export function GET(): Response {
  const cards = cardFiles();
  const build = process.env.PAX_BUILD || "dev";
  // A new card list (a card added or renamed) starts a fresh card cache; otherwise it's kept.
  const cardsTag = createHash("sha1").update(cards.join("\n")).digest("hex").slice(0, 10);
  const script = SERVICE_WORKER.replace("__CONFIG__", JSON.stringify({ build, cardsTag, pages: PAGES, cards, width: CARD_WIDTH, quality: CARD_QUALITY }));
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Always check for a new worker, so updates arrive on the next visit.
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

const SERVICE_WORKER = String.raw`/* Pax Corruption offline support. Generated per build by app/sw.js/route.ts. */
const CONFIG = __CONFIG__;
const SHELL = "pax-shell-" + CONFIG.build;
const CARDS = "pax-cards-" + CONFIG.cardsTag;
const RUNTIME = "pax-runtime-" + CONFIG.build;
const KEEP = [SHELL, CARDS, RUNTIME];

const imageUrl = (src) => "/_next/image?url=" + encodeURIComponent(src) + "&w=" + CONFIG.width + "&q=" + CONFIG.quality;

/** Save the pages and every script and stylesheet they load. */
async function saveShell() {
  const cache = await caches.open(SHELL);
  const assets = new Set(["/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/favicon.ico", "/icons/icon-192.png", "/icons/icon-512.png"]);
  for (const page of CONFIG.pages) {
    const response = await fetch(page, { cache: "reload" });
    if (!response.ok) throw new Error("Couldn't save " + page);
    const html = await response.clone().text();
    await cache.put(page, response);
    for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(match[0]);
  }
  await Promise.allSettled([...assets].map((url) => cache.add(new Request(url, { cache: "reload" }))));
}

/** Save every card image once (skipping ones already saved). A failure here never blocks install. */
async function saveCards() {
  const cache = await caches.open(CARDS);
  const missing = [];
  for (const src of CONFIG.cards) if (!(await cache.match(imageUrl(src)))) missing.push(src);
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.allSettled(missing.slice(i, i + 8).map((src) => cache.add(imageUrl(src))));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(saveShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("pax-") && !KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
      await saveCards();
    })(),
  );
});

/** Offline, a card at a width that wasn't saved: answer with the saved copy (the biggest one). */
async function anySavedWidth(request) {
  const wanted = new URL(request.url).searchParams.get("url");
  let best = null;
  let bestWidth = -1;
  for (const name of [CARDS, RUNTIME]) {
    const cache = await caches.open(name);
    for (const key of await cache.keys()) {
      const params = new URL(key.url).searchParams;
      if (params.get("url") !== wanted) continue;
      const width = Number(params.get("w")) || 0;
      if (width > bestWidth) {
        bestWidth = width;
        best = key;
      }
    }
  }
  return best ? caches.match(best) : undefined;
}

async function optimizedImage(request) {
  const saved = await caches.match(request);
  if (saved) return saved;
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  } catch (error) {
    const fallback = await anySavedWidth(request);
    if (fallback) return fallback;
    throw error;
  }
}

/** Pages: the network first (always the latest), the saved copy when offline. */
async function page(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && CONFIG.pages.includes(url.pathname)) (await caches.open(SHELL)).put(url.pathname, response.clone());
    return response;
  } catch (error) {
    const saved = (await caches.match(url.pathname)) || (await caches.match("/"));
    if (saved) return saved;
    throw error;
  }
}

/** Build files never change under the same name: saved copy first. */
async function staticAsset(request) {
  const saved = await caches.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) (await caches.open(SHELL)).put(request, response.clone());
  return response;
}

/** Other images and icons: saved copy at once, refreshed in the background. */
async function publicFile(request) {
  const cache = await caches.open(RUNTIME);
  const saved = await caches.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return saved || (await fresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only this site: the online-game server and other sites are left alone.
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return event.respondWith(page(request));
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(staticAsset(request));
  if (url.pathname === "/_next/image") return event.respondWith(optimizedImage(request));
  if (/^\/(cards|art|icons)\//.test(url.pathname) || /\.(png|jpe?g|webp|svg|ico|webmanifest)$/.test(url.pathname)) {
    return event.respondWith(publicFile(request));
  }
});
`;
