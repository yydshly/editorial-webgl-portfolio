import { describe, expect, it } from "vitest";

import { heroSceneConfig } from "@/lib/webgl/hero/heroSceneConfig";

type ResponsiveCropSelector = {
  readonly selectUvRect?: (viewportWidth: number) => {
    readonly uMin: number;
    readonly uMax: number;
    readonly vMin: number;
    readonly vMax: number;
  };
};

describe("hero foreground crop manifest selection", () => {
  it("maps desktop and mobile UVs to the same master microphone-hand pixels", () => {
    const foreground = heroSceneConfig.foreground as unknown as ResponsiveCropSelector;
    expect(foreground.selectUvRect).toBeTypeOf("function");

    const desktop = foreground.selectUvRect!(1440);
    const mobile = foreground.selectUvRect!(390);
    const desktopMasterPixels = {
      left: desktop.uMin * 1024,
      right: desktop.uMax * 1024,
      top: desktop.vMin * 1536,
      bottom: desktop.vMax * 1536,
    };
    const mobileMasterPixels = {
      left: 264 + mobile.uMin * 760,
      right: 264 + mobile.uMax * 760,
      top: mobile.vMin * 1536,
      bottom: mobile.vMax * 1536,
    };

    expect(mobileMasterPixels.left).toBeCloseTo(desktopMasterPixels.left, 4);
    expect(mobileMasterPixels.right).toBeCloseTo(desktopMasterPixels.right, 4);
    expect(mobileMasterPixels.top).toBeCloseTo(desktopMasterPixels.top, 4);
    expect(mobileMasterPixels.bottom).toBeCloseTo(desktopMasterPixels.bottom, 4);
    expect(desktopMasterPixels.left).toBeGreaterThanOrEqual(270);
    expect(desktopMasterPixels.right).toBeLessThanOrEqual(510);
    expect(desktopMasterPixels.top).toBeGreaterThanOrEqual(640);
    expect(desktopMasterPixels.bottom).toBeLessThanOrEqual(1090);
  });
});
