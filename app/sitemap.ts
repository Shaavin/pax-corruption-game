import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Only the pages worth finding in search. Game tables and tools are `noindex`.
 * No `lastModified`: stamping every request with "now" is a date Google learns to ignore.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
      // app/opengraph-image.jpg, the share image for the homepage.
      images: [`${SITE_URL}/opengraph-image.jpg`],
    },
    { url: `${SITE_URL}/learn`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/online`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
