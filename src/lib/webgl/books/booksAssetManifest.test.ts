import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { getSectionByKind } from "@/content";

import {
  booksAssetManifest,
  getBooksCoverById,
  parseBooksAssetManifest,
} from "./booksAssetManifest";

const coverFixtures = {
  primary: {
    id: "people-in-the-room",
    title: "在场的人",
    subtitle: "People in the Room",
    author: "DEV-HOST-01",
    series: "FIELD NOTES",
    status: "development",
    visualRole: "primary",
    visualSubject: "person-led",
    masterSemanticId: "field-notes:people-in-the-room:v1",
    source: {
      path: "/assets-source/books/people-in-the-room-master.png",
      width: 1200,
      height: 1800,
    },
    desktop: {
      path: "/assets/books/people-in-the-room-desktop.webp",
      width: 1000,
      height: 1500,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    mobile: {
      path: "/assets/books/people-in-the-room-mobile.webp",
      width: 800,
      height: 1200,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    focalPoint: { x: 0.5, y: 0.44 },
    expectedCoverBounds: { x: 0, y: 0, width: 1, height: 1 },
    colorSpace: "sRGB",
  },
  left: {
    id: "between-the-cities",
    title: "城市之间",
    subtitle: "Between the Cities",
    author: "DEV-HOST-01",
    series: "FIELD NOTES",
    status: "development",
    visualRole: "secondary-left",
    visualSubject: "scene-led",
    masterSemanticId: "field-notes:between-the-cities:v1",
    source: {
      path: "/assets-source/books/between-the-cities-master.png",
      width: 1200,
      height: 1800,
    },
    desktop: {
      path: "/assets/books/between-the-cities-desktop.webp",
      width: 1000,
      height: 1500,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    mobile: {
      path: "/assets/books/between-the-cities-mobile.webp",
      width: 800,
      height: 1200,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    focalPoint: { x: 0.5, y: 0.5 },
    expectedCoverBounds: { x: 0, y: 0, width: 1, height: 1 },
    colorSpace: "sRGB",
  },
  right: {
    id: "hearing-one-another",
    title: "彼此听见",
    subtitle: "Hearing One Another",
    author: "DEV-HOST-01",
    series: "FIELD NOTES",
    status: "development",
    visualRole: "secondary-right",
    visualSubject: "relationship-led",
    masterSemanticId: "field-notes:hearing-one-another:v1",
    source: {
      path: "/assets-source/books/hearing-one-another-master.png",
      width: 1200,
      height: 1800,
    },
    desktop: {
      path: "/assets/books/hearing-one-another-desktop.webp",
      width: 1000,
      height: 1500,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    mobile: {
      path: "/assets/books/hearing-one-another-mobile.webp",
      width: 800,
      height: 1200,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    focalPoint: { x: 0.48, y: 0.45 },
    expectedCoverBounds: { x: 0, y: 0, width: 1, height: 1 },
    colorSpace: "sRGB",
  },
};

function validManifest() {
  return {
    seriesId: "field-notes",
    seriesLabel: "FIELD NOTES",
    seriesLabelZh: "在场档案",
    author: "DEV-HOST-01",
    status: "development",
    assetAvailability: "manifest-only",
    mobileBreakpoint: 768,
    colorSpace: "sRGB",
    covers: [
      structuredClone(coverFixtures.right),
      structuredClone(coverFixtures.primary),
      structuredClone(coverFixtures.left),
    ],
  };
}

describe("Books asset manifest", () => {
  it("packages nine decodable development cover files at their declared dimensions", async () => {
    const projectDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../..",
    );
    const publicDirectory = path.join(projectDirectory, "public");
    const assets = booksAssetManifest.covers.flatMap((cover) => [
      { ...cover.source, expectedFormat: "png" },
      { ...cover.desktop, expectedFormat: "webp" },
      { ...cover.mobile, expectedFormat: "webp" },
    ]);

    expect(booksAssetManifest.status).toBe("development");
    expect(booksAssetManifest.assetAvailability).toBe("packaged");
    expect(assets).toHaveLength(9);

    for (const asset of assets) {
      const assetRoot = asset.path.startsWith("/assets-source/")
        ? projectDirectory
        : publicDirectory;
      const absolutePath = path.join(assetRoot, asset.path);
      expect(existsSync(absolutePath), absolutePath).toBe(true);
      await expect(sharp(absolutePath).metadata()).resolves.toMatchObject({
        width: asset.width,
        height: asset.height,
        format: asset.expectedFormat,
        space: "srgb",
      });
    }
  });

  it("keeps manifest identity and responsive paths aligned with semantic DOM content", () => {
    const books = getSectionByKind("books");

    expect(books).toBeDefined();
    expect(booksAssetManifest.covers.map((cover) => [
      cover.id,
      cover.title,
      cover.subtitle,
      cover.author,
      cover.series,
      cover.status,
    ])).toEqual(
      books?.items.map((item) => [
        item.id,
        item.titleZh,
        item.subtitleEn,
        books.author,
        books.series.label,
        books.series.assetStatus,
      ]),
    );
    expect(booksAssetManifest.covers.map((cover) => cover.desktop.path)).toEqual(
      books?.items.map((item) => item.cover.desktop.src),
    );
    expect(booksAssetManifest.covers.map((cover) => cover.mobile.path)).toEqual(
      books?.items.map((item) => item.cover.mobile.src),
    );
    expect(getBooksCoverById("between-the-cities")?.visualRole).toBe(
      "secondary-left",
    );
    expect(getBooksCoverById("missing")).toBeUndefined();
  });

  it("parses the complete development contract and returns semantic role order", () => {
    const manifest = parseBooksAssetManifest(validManifest());

    expect(manifest).toMatchObject({
      seriesId: "field-notes",
      seriesLabel: "FIELD NOTES",
      seriesLabelZh: "在场档案",
      author: "DEV-HOST-01",
      status: "development",
      assetAvailability: "manifest-only",
      mobileBreakpoint: 768,
      colorSpace: "sRGB",
    });
    expect(manifest.covers.map((cover) => cover.visualRole)).toEqual([
      "primary",
      "secondary-left",
      "secondary-right",
    ]);
    expect(manifest.covers.map((cover) => cover.visualSubject)).toEqual([
      "person-led",
      "scene-led",
      "relationship-led",
    ]);
  });

  it("keeps every variant inside the Books directory with one 2:3 series ratio", () => {
    const manifest = parseBooksAssetManifest(validManifest());

    for (const cover of manifest.covers) {
      expect([cover.source, cover.desktop, cover.mobile].map((asset) => [
        asset.width / asset.height,
        asset.path.startsWith("/assets-source/books/") || asset.path.startsWith("/assets/books/"),
      ])).toEqual([
        [2 / 3, true],
        [2 / 3, true],
        [2 / 3, true],
      ]);
      expect(cover.masterSemanticId).toBe(`field-notes:${cover.id}:v1`);
    }
  });

  it("rejects duplicate ids, roles, or master semantics and requires all three roles", () => {
    const duplicateId = validManifest();
    duplicateId.covers[2].id = duplicateId.covers[1].id;
    expect(() => parseBooksAssetManifest(duplicateId)).toThrow("unique ids");

    const duplicateRole = validManifest();
    duplicateRole.covers[2].visualRole = "primary";
    expect(() => parseBooksAssetManifest(duplicateRole)).toThrow(
      "exactly one cover for each visualRole",
    );

    const duplicateSemantic = validManifest();
    duplicateSemantic.covers[2].masterSemanticId =
      duplicateSemantic.covers[1].masterSemanticId;
    expect(() => parseBooksAssetManifest(duplicateSemantic)).toThrow(
      "masterSemanticId",
    );

    expect(() =>
      parseBooksAssetManifest({
        ...validManifest(),
        covers: [...validManifest().covers, coverFixtures.primary],
      }),
    ).toThrow("exactly three covers");
  });

  it("rejects paths outside /assets/books and malformed URI paths", () => {
    const traversal = validManifest();
    traversal.covers[0].desktop.path = "/assets/books/../../outside.webp";
    expect(() => parseBooksAssetManifest(traversal)).toThrow(
      "covers[0].desktop.path",
    );

    const encodedTraversal = validManifest();
    encodedTraversal.covers[0].mobile.path =
      "/assets/books/%2e%2e/outside.webp";
    expect(() => parseBooksAssetManifest(encodedTraversal)).toThrow(
      "covers[0].mobile.path",
    );
  });

  it("rejects non-positive or non-2:3 source and variant dimensions", () => {
    const zeroWidth = validManifest();
    zeroWidth.covers[0].source.width = 0;
    expect(() => parseBooksAssetManifest(zeroWidth)).toThrow(
      "covers[0].source.width",
    );

    const wrongRatio = validManifest();
    wrongRatio.covers[0].desktop.width = 999;
    expect(() => parseBooksAssetManifest(wrongRatio)).toThrow("2:3");

    const wrongSourceSize = validManifest();
    wrongSourceSize.covers[0].source = {
      ...wrongSourceSize.covers[0].source,
      width: 1000,
      height: 1500,
    };
    expect(() => parseBooksAssetManifest(wrongSourceSize)).toThrow(
      "covers[0].source must be exactly 1200x1800",
    );

    const wrongDesktopSize = validManifest();
    wrongDesktopSize.covers[0].desktop = {
      ...wrongDesktopSize.covers[0].desktop,
      width: 800,
      height: 1200,
    };
    expect(() => parseBooksAssetManifest(wrongDesktopSize)).toThrow(
      "covers[0].desktop must be exactly 1000x1500",
    );

    const wrongMobileSize = validManifest();
    wrongMobileSize.covers[0].mobile = {
      ...wrongMobileSize.covers[0].mobile,
      width: 1200,
      height: 1800,
    };
    expect(() => parseBooksAssetManifest(wrongMobileSize)).toThrow(
      "covers[0].mobile must be exactly 800x1200",
    );
  });

  it("rejects crops, focal points, and expected bounds outside normalized space", () => {
    const invalidCrop = validManifest();
    invalidCrop.covers[0].desktop.crop = {
      x: 0.8,
      y: 0,
      width: 0.4,
      height: 1,
    };
    expect(() => parseBooksAssetManifest(invalidCrop)).toThrow(
      "covers[0].desktop.crop",
    );

    const focalOutsideCrop = validManifest();
    focalOutsideCrop.covers[0].mobile.crop = {
      x: 0,
      y: 0,
      width: 0.4,
      height: 1,
    };
    expect(() => parseBooksAssetManifest(focalOutsideCrop)).toThrow(
      "focalPoint must fall inside",
    );

    const zeroBounds = validManifest();
    zeroBounds.covers[0].expectedCoverBounds.width = 0;
    expect(() => parseBooksAssetManifest(zeroBounds)).toThrow(
      "expectedCoverBounds",
    );
  });

  it("fails safely for production claims and identity contract drift", () => {
    expect(() =>
      parseBooksAssetManifest({ ...validManifest(), status: "production" }),
    ).toThrow('status must be "development"');
    expect(() =>
      parseBooksAssetManifest({ ...validManifest(), author: "A real author" }),
    ).toThrow("author");
    expect(() =>
      parseBooksAssetManifest({ ...validManifest(), colorSpace: "Display-P3" }),
    ).toThrow("colorSpace");

    const coverDrift = validManifest();
    coverDrift.covers[0].status = "production";
    expect(() => parseBooksAssetManifest(coverDrift)).toThrow(
      "covers[0].status",
    );
  });

  it("fails safely when a required rich metadata field is absent", () => {
    const missingSubtitle = validManifest();
    delete (missingSubtitle.covers[0] as { subtitle?: string }).subtitle;

    expect(() => parseBooksAssetManifest(missingSubtitle)).toThrow(
      "covers[0].subtitle",
    );
  });
});
