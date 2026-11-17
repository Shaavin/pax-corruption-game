import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Pax",
    description: SITE_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    categories: ["games", "entertainment"],
    // Long-press the installed icon: jump straight to a game.
    shortcuts: [
      { name: "Pass & play", short_name: "Pass & play", url: "/play", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Play the computer", short_name: "vs Computer", url: "/play?ai=normal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Continue your game", short_name: "Continue", url: "/play?resume=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
