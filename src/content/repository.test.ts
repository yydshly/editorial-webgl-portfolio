import { describe, expect, it } from "vitest";

import {
  getAllSections,
  getSectionByKind,
  getSiteContent,
} from "./repository";

describe("content repository", () => {
  it("returns ordered sections with all expected kinds", () => {
    const sections = getAllSections();
    const kinds = sections.map((section) => section.kind);

    expect(kinds).toEqual([
      "hero",
      "media",
      "manifesto",
      "about",
      "news",
      "quote",
      "books",
    ]);
  });

  it("returns section by kind with correct type narrowing", () => {
    const hero = getSectionByKind("hero");
    const books = getSectionByKind("books");

    expect(hero?.kind).toBe("hero");
    expect(books?.kind).toBe("books");
  });

  it("provides the approved FIELD NOTES publication archive in semantic order", () => {
    const books = getSectionByKind("books");

    expect(books?.author).toBe("DEV-HOST-01");
    expect(books?.series).toEqual({
      label: "FIELD NOTES",
      labelZh: "在场档案",
      assetStatus: "development",
    });
    expect(
      books?.items.map((item) => [
        item.id,
        item.role,
        item.titleZh,
        item.subtitleEn,
      ]),
    ).toEqual([
      ["people-in-the-room", "primary", "在场的人", "People in the Room"],
      ["between-the-cities", "secondary-left", "城市之间", "Between the Cities"],
      ["hearing-one-another", "secondary-right", "彼此听见", "Hearing One Another"],
    ]);
    expect(books?.items.map((item) => item.cover.desktop.src)).toEqual([
      "/assets/books/people-in-the-room-desktop.webp",
      "/assets/books/between-the-cities-desktop.webp",
      "/assets/books/hearing-one-another-desktop.webp",
    ]);
    expect(books?.items.every((item) => item.action.status === "development")).toBe(
      true,
    );
  });

  it("does not leave real-person, television, or broadcast records in Books", () => {
    const books = getSectionByKind("books");
    const serializedBooks = JSON.stringify(books);

    expect(serializedBooks).not.toMatch(/Born a Crime|The Daily Show|Trevor Noah/i);
    expect(serializedBooks).not.toMatch(/Television|Broadcast/i);
  });

  it("provides the approved fictional DEV-HOST-01 archive timeline", () => {
    const about = getSectionByKind("about");

    expect(about?.timeline).toMatchObject([
      {
        id: "origin",
        year: "2010",
        place: "Xi'an",
        title: "Observation becomes expression",
        keyFact: "Completes her first character interview and campus feature.",
      },
      {
        id: "industry",
        year: "2015",
        place: "Shanghai",
        title: "Learning the work behind the story",
        keyFact: "Joins a content team and takes responsibility for topics and drafting.",
      },
      {
        id: "on-camera",
        year: "2020",
        place: "Beijing",
        title: "Bringing research in front of the camera",
        keyFact: "Hosts her first formal interview programme.",
      },
      {
        id: "cross-cultural",
        year: "2026",
        place: "New York",
        title: "Cross-cultural public expression",
        keyFact: "Launches and independently produces a cross-cultural content project.",
      },
    ]);
  });

  it("returns full site payload metadata", () => {
    const site = getSiteContent();
    expect(site.locale).toBe("en");
    expect(site.brand.domain).toContain("trevornoah");
    expect(site.nav).toHaveLength(7);
  });

  it("uses the development portrait assets for the visible DOM fallback", () => {
    const hero = getSectionByKind("hero");
    const media = getSectionByKind("media");

    expect(hero?.visual?.src).toBe("/assets/hero/hero-placeholder-desktop.webp");
    expect(media?.gallery.map((item) => item.image.src)).toEqual([
      "/assets/media/media-stage-desktop.webp",
      "/assets/media/media-studio-desktop.webp",
    ]);
  });
});
