import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

import {
  aboutAssetManifest,
  parseAboutAssetManifest,
  selectAboutPortraitSource,
} from "@/lib/webgl/about/aboutAssetManifest";

const validManifest = {
  assetId: "about-portrait-dev-host-01",
  identity: "DEV-HOST-01",
  status: "development",
  assetAvailability: "manifest-only",
  mobileBreakpoint: 768,
  master: {
    path: "/assets-source/about/about-portrait-master.png",
    width: 1600,
    height: 2200,
  },
  desktop: {
    path: "/assets/about/about-portrait-desktop.webp",
    width: 1280,
    height: 1760,
    crop: { x: 0, y: 0, width: 0.8, height: 0.8 },
    focalPoint: { x: 0.31, y: 0.42 },
  },
  mobile: {
    path: "/assets/about/about-portrait-mobile.webp",
    width: 900,
    height: 1400,
    crop: { x: 0.08, y: 0, width: 0.72, height: 0.9 },
    focalPoint: { x: 0.4, y: 0.4 },
  },
  subjectBounds: { x: 0.1, y: 0.16, width: 0.34, height: 0.68 },
  colorSpace: "sRGB",
  composition: {
    subjectPosition: "left",
    gazeDirection: "right",
    breathingRoom: "right",
    sameMasterSemantic: true,
  },
} as const;

describe("About asset manifest", () => {
  it("describes a packaged development portrait whose three image files decode at their declared dimensions", async () => {
    const projectDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../..",
    );
    const publicDirectory = path.join(projectDirectory, "public");
    const assets = [
      aboutAssetManifest.master,
      aboutAssetManifest.desktop,
      aboutAssetManifest.mobile,
    ];

    expect(aboutAssetManifest.status).toBe("development");
    expect(aboutAssetManifest.assetAvailability).toBe("packaged");

    for (const asset of assets) {
      const assetRoot = asset.path.startsWith("/assets-source/")
        ? projectDirectory
        : publicDirectory;
      const absolutePath = path.join(assetRoot, asset.path);
      expect(existsSync(absolutePath)).toBe(true);
      await expect(sharp(absolutePath).metadata()).resolves.toMatchObject({
        width: asset.width,
        height: asset.height,
      });
    }
  });

  it("exposes the DEV-HOST-01 development fixture with all portrait sources", () => {
    expect(aboutAssetManifest.assetId).toBe("about-portrait-dev-host-01");
    expect(aboutAssetManifest.identity).toBe("DEV-HOST-01");
    expect(aboutAssetManifest.status).toBe("development");
    expect(aboutAssetManifest.assetAvailability).toBe("packaged");
    expect(aboutAssetManifest.master.path).toBe("/assets-source/about/about-portrait-master.png");
    expect(aboutAssetManifest.desktop.path).toBe("/assets/about/about-portrait-desktop.webp");
    expect(aboutAssetManifest.mobile.path).toBe("/assets/about/about-portrait-mobile.webp");
    expect(aboutAssetManifest.colorSpace).toBe("sRGB");
    expect(aboutAssetManifest.composition).toEqual({
      subjectPosition: "left",
      gazeDirection: "right",
      breathingRoom: "right",
      sameMasterSemantic: true,
    });
    expect(aboutAssetManifest.subjectBounds).toEqual({ x: 0.03, y: 0.15, width: 0.64, height: 0.82 });
  });

  it("selects the mobile crop at the shared breakpoint and otherwise keeps the desktop source", () => {
    expect(selectAboutPortraitSource(768)).toBe("/assets/about/about-portrait-mobile.webp");
    expect(selectAboutPortraitSource(769)).toBe("/assets/about/about-portrait-desktop.webp");
    expect(selectAboutPortraitSource(0)).toBe("/assets/about/about-portrait-desktop.webp");
  });

  it("rejects a missing required portrait path before runtime use", () => {
    const missingDesktopPath = {
      ...validManifest,
      desktop: { ...validManifest.desktop, path: "" },
    };

    expect(() => parseAboutAssetManifest(missingDesktopPath)).toThrow('desktop.path');
  });

  it("rejects a portrait path that traverses outside the About asset directory", () => {
    expect(() =>
      parseAboutAssetManifest({
        ...validManifest,
        desktop: { ...validManifest.desktop, path: "/assets/about/../../outside.webp" },
      }),
    ).toThrow("desktop.path");
  });

  it("rejects illegal status and normalised composition geometry", () => {
    expect(() => parseAboutAssetManifest({ ...validManifest, status: "staging" })).toThrow("status");
    expect(() =>
      parseAboutAssetManifest({
        ...validManifest,
        subjectBounds: { x: 0.8, y: 0.16, width: 0.34, height: 0.68 },
      }),
    ).toThrow("subjectBounds");
    expect(() =>
      parseAboutAssetManifest({
        ...validManifest,
        desktop: { ...validManifest.desktop, focalPoint: { x: 1.01, y: 0.42 } },
      }),
    ).toThrow("desktop.focalPoint.x");
    expect(() =>
      parseAboutAssetManifest({
        ...validManifest,
        desktop: { ...validManifest.desktop, focalPoint: { x: 0.95, y: 0.42 } },
      }),
    ).toThrow("desktop.focalPoint");
  });
});
