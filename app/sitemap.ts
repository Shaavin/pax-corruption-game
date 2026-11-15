import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only the pages worth finding in search. Game tables and tools are `noindex`. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      // app/opengraph-image.jpg, the share image for the homepage.
      images: [`${SITE_URL}/opengraph-image.jpg`],
    },
    { url: `${SITE_URL}/online`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
