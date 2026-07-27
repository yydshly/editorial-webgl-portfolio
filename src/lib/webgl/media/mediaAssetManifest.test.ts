import mediaManifest from "../../../../public/assets/media/media-manifest.json";
import { describe, expect, it } from "vitest";

type StageAsset = {
  readonly assetId: string;
  readonly cropIntent?: string;
  readonly portraitCoverage?: {
    readonly desktop?: number;
    readonly mobile?: number;
  };
  readonly grade?: {
    readonly midtoneExposureEV?: number;
    readonly subjectMidtoneExposureEV?: number;
    readonly preserveHighlights?: boolean;
    readonly preserveStageBlack?: boolean;
  };
};

describe("media stage asset grade", () => {
  it("declares a restrained local subject lift without lifting stage blacks", () => {
    const stage = (mediaManifest.assets as readonly StageAsset[]).find(
      (asset) => asset.assetId === "media-stage",
    );

    expect(stage?.grade?.midtoneExposureEV).toBe(0.3);
    expect(stage?.grade?.subjectMidtoneExposureEV).toBeGreaterThanOrEqual(0.1);
    expect(stage?.grade?.subjectMidtoneExposureEV).toBeLessThanOrEqual(0.15);
    expect(stage?.grade?.preserveHighlights).toBe(true);
    expect(stage?.grade?.preserveStageBlack).toBe(true);
  });

  it("declares the R3 editorial crops that keep the Main dominant and the Secondary legible in its exposed left band", () => {
    const assets = mediaManifest.assets as readonly StageAsset[];
    const stage = assets.find((asset) => asset.assetId === "media-stage");
    const studio = assets.find((asset) => asset.assetId === "media-studio");

    expect(stage?.cropIntent).toBe("editorial-stage-main-r3");
    expect(stage?.portraitCoverage).toEqual({ desktop: 0.75, mobile: 0.72 });
    expect(studio?.cropIntent).toBe("studio-left-readable-r3");
    expect(studio?.portraitCoverage).toEqual({ desktop: 0.68, mobile: 0.66 });
  });
});
