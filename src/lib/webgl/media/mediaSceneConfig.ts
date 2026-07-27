import mediaManifest from "../../../../public/assets/media/media-manifest.json";
import type { CameraIntentVector } from "@/lib/webgl/CameraIntent";

type MediaManifestAsset = {
  readonly assetId: string;
  readonly semanticSlot: "main" | "secondary";
  readonly desktop: {
    readonly path: string;
  };
  readonly mobile: {
    readonly path: string;
  };
  readonly focalPoint: {
    readonly desktop: { readonly x: number; readonly y: number };
    readonly mobile: { readonly x: number; readonly y: number };
  };
};

type MediaManifest = {
  readonly mobileBreakpoint: number;
  readonly assets: readonly MediaManifestAsset[];
};

type LayerSemantic = MediaManifestAsset["semanticSlot"];

const resolvedManifest = mediaManifest as MediaManifest;

function getManifestAsset(assetId: string): MediaManifestAsset {
  const asset = resolvedManifest.assets.find((entry) => entry.assetId === assetId);
  if (!asset) {
    throw new Error(`Media manifest missing required asset "${assetId}".`);
  }

  return asset;
}

function selectAssetSource(asset: MediaManifestAsset, viewportWidth: number): string {
  if (viewportWidth > 0 && viewportWidth <= resolvedManifest.mobileBreakpoint) {
    return asset.mobile.path;
  }
  return asset.desktop.path;
}

type MediaSceneLayerConfig = {
  readonly assetId: string;
  readonly semanticSlot: LayerSemantic;
  readonly focalPoint: {
    readonly desktop: { readonly x: number; readonly y: number };
    readonly mobile: { readonly x: number; readonly y: number };
  };
  readonly assetSources: {
    readonly desktop: string;
    readonly mobile: string;
  };
  readonly plane: {
    readonly width: number;
    readonly height: number;
    readonly minimumResponsiveWidth: number;
    readonly depth: number;
    readonly z: number;
    readonly scale: number;
    readonly opacity: number;
  };
  readonly selectAssetSource: (viewportWidth: number) => string;
};

type MediaCameraIntentPose = {
  readonly targetOffset: CameraIntentVector;
  readonly positionOffset: CameraIntentVector;
  readonly fovIntent: number;
};

type MediaSceneCameraIntentConfig = {
  readonly enter: MediaCameraIntentPose;
  readonly hold: MediaCameraIntentPose;
  readonly depart: MediaCameraIntentPose;
  readonly depthBias: number;
  readonly weight: number;
};

export const MEDIA_SCENE_ID = "media-scene";
export const MEDIA_SCENE_ANCHOR_ID = "media";

const SECONDARY_PLANE = {
  width: 320,
  height: 200,
  minimumResponsiveWidth: 220,
  depth: 1,
} as const;

const MAIN_PLANE = {
  width: 361,
  height: 226,
  minimumResponsiveWidth: 244,
  depth: 1,
} as const;

const mainAsset = getManifestAsset("media-stage");
const secondaryAsset = getManifestAsset("media-studio");

export const mediaSceneConfig = {
  id: MEDIA_SCENE_ID,
  anchorId: MEDIA_SCENE_ANCHOR_ID,
  mobileBreakpoint: resolvedManifest.mobileBreakpoint,
  main: {
    assetId: mainAsset.assetId,
    semanticSlot: mainAsset.semanticSlot as LayerSemantic,
    focalPoint: mainAsset.focalPoint,
    assetSources: {
      desktop: mainAsset.desktop.path,
      mobile: mainAsset.mobile.path,
    },
    plane: {
      ...MAIN_PLANE,
      z: 0,
      scale: 1,
      opacity: 1,
    },
    selectAssetSource(width: number): string {
      return selectAssetSource(mainAsset, width);
    },
  } as MediaSceneLayerConfig,
  secondary: {
    assetId: secondaryAsset.assetId,
    semanticSlot: secondaryAsset.semanticSlot as LayerSemantic,
    focalPoint: secondaryAsset.focalPoint,
    assetSources: {
      desktop: secondaryAsset.desktop.path,
      mobile: secondaryAsset.mobile.path,
    },
    plane: {
      ...SECONDARY_PLANE,
      z: -0.35,
      scale: 0.78,
      opacity: 0.85,
    },
    selectAssetSource(width: number): string {
      return selectAssetSource(secondaryAsset, width);
    },
  } as MediaSceneLayerConfig,
  cameraIntent: {
    enter: {
      targetOffset: {
        x: 0,
        y: -0.06,
        z: 0,
      },
      positionOffset: {
        x: -0.14,
        y: 0.04,
        z: 0.36,
      },
      fovIntent: 50,
    },
    hold: {
      targetOffset: {
        x: 0,
        y: 0,
        z: 0,
      },
      positionOffset: {
        x: -0.06,
        y: 0,
        z: 0.35,
      },
      fovIntent: 48,
    },
    depart: {
      targetOffset: {
        x: 0.04,
        y: 0.08,
        z: 0,
      },
      positionOffset: {
        x: 0.08,
        y: -0.03,
        z: 0.38,
      },
      fovIntent: 46,
    },
    depthBias: -0.2,
    weight: 1,
  } as const satisfies MediaSceneCameraIntentConfig,
} as const;

export type MediaSceneConfig = Omit<typeof mediaSceneConfig, "anchorId"> & {
  anchorId: string;
};

export type MediaLayerConfig = MediaSceneLayerConfig;
