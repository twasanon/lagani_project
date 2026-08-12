import type { MetadataRoute } from "next";

import { getPublicSiteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = getPublicSiteConfig();
  const paths = ["/", "/privacy", "/terms"];

  return paths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.4,
  }));
}
