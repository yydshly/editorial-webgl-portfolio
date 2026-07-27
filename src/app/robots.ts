import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
    sitemap: new URL("/sitemap.xml", resolveSiteUrl()).toString(),
  };
}
