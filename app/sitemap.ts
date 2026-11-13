import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only the pages worth finding in search. Game tables and tools are `noindex`. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/online`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
