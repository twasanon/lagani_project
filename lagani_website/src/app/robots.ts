import type { MetadataRoute } from "next";

import { getPublicSiteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = getPublicSiteConfig();

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
