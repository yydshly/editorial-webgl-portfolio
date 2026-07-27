import fs from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { metadata } from "./layout";
import getSitemap from "./sitemap";
import getRobots from "./robots";
import HomePage from "./page";
import SiteChrome from "@/components/layout/SiteChrome";

describe("MVP-06 SEO baseline", () => {
  it("exports production metadata with Open Graph and Twitter cards", () => {
    expect(metadata.title).toMatchObject({
      default: "Trevor Noah Style Website",
      template: "Trevor Noah Style Website | %s",
    });
    expect(metadata.description).toContain("SEO-oriented");
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBe("Trevor Noah Style Website");
    const openGraphImages = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph.images
      : metadata.openGraph?.images
        ? [metadata.openGraph.images]
        : [];
    expect(openGraphImages).toHaveLength(1);
    expect(openGraphImages[0]).toMatchObject({
      url: "/assets/placeholders/og-image.svg",
      alt: "Trevor Noah Style hero image",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Trevor Noah Style Website",
      site: "@example",
    });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("serves robots directive and sitemap route references", () => {
    const robotsManifest = getRobots();

    const rules = Array.isArray(robotsManifest.rules)
      ? robotsManifest.rules
      : robotsManifest.rules
        ? [robotsManifest.rules]
        : [];

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      userAgent: "*",
      allow: "/",
    });
    expect(robotsManifest.sitemap).toBe("https://www.trevornoah.com/sitemap.xml");
  });

  it("generates sitemap entries for baseline pages", () => {
    const items = getSitemap();
    const urls = items.map((item) => new URL(item.url).pathname);

    expect(urls).toHaveLength(4);
    expect(urls).toEqual(
      expect.arrayContaining(["/", "/privacy", "/terms", "/contact"]),
    );
  });
});

describe("MVP-06 accessibility baseline", () => {
  it("supports skip link to #site-content and stable main id", () => {
    render(
      <SiteChrome
        brandName="Trevor Noah Style"
        navItems={[{ id: "hero", label: "Hero", href: "#hero" }]}
      >
        <HomePage />
      </SiteChrome>,
    );

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute("href", "#site-content");

    const main = document.getElementById("site-content");
    expect(main).toBeInTheDocument();
    expect(main?.tagName.toLowerCase()).toBe("main");

    expect(screen.getByRole("main")).toHaveAttribute("id", "site-content");
  });
});

describe("MVP-06 responsive and reduced-motion baseline", () => {
  it("contains required CSS queries for responsive and reduced motion", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(css).toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)/i,
    );
    expect(css).toContain(".skip-link");
  });
});
