// Runs in the browser before the app becomes interactive (Next.js convention).

// Offline support for the installed app (see app/sw.js/route.ts). Production builds only:
// in development a caching worker would serve stale pages.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // No offline support this visit (private mode, blocked storage); the site still works.
    });
  });
}
