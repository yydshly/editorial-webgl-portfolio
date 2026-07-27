import {
  aboutAssetManifest,
  selectAboutPortraitSource,
  type AboutAssetManifest,
} from "@/lib/webgl/about/aboutAssetManifest";
import type { CameraIntentVector } from "@/lib/webgl/CameraIntent";

export const ABOUT_SCENE_ID = "about-scene";
export const ABOUT_SCENE_ANCHOR_ID = "about";
export const ABOUT_PORTRAIT_ANCHOR_ID = "about-portrait";
export const ABOUT_PORTRAIT_TEXTURE_OWNER_ID =
  `${ABOUT_SCENE_ID}:portrait-texture`;

export type AboutPortraitResponsiveAsset = {
  readonly id: string;
  readonly src: string;
};

export type AboutPortraitStagePose = {
  readonly translateX: number;
  readonly translateY: number;
  readonly scale: number;
  readonly opacity: number;
  readonly colorMultiplier: number;
};

export type AboutCameraIntentStagePose = {
  readonly targetOffset: CameraIntentVector;
  readonly positionOffset: CameraIntentVector;
};

export type AboutSceneConfig = {
  readonly id: typeof ABOUT_SCENE_ID;
  readonly anchorId: string;
  readonly portraitAnchorId: string;
  readonly mobileBreakpoint: number;
  readonly portrait: {
    readonly assetId: string;
    readonly status: AboutAssetManifest["status"];
    readonly identity: AboutAssetManifest["identity"];
    readonly assetSources: {
      readonly desktop: string;
      readonly mobile: string;
    };
    readonly assets: {
      readonly desktop: AboutPortraitResponsiveAsset;
      readonly mobile: AboutPortraitResponsiveAsset;
    };
    readonly selectAssetSource: (viewportWidth: number) => string;
    readonly selectAsset: (
      viewportWidth: number,
    ) => AboutPortraitResponsiveAsset;
    readonly selectVariant: (
      viewportWidth: number,
    ) => AboutAssetManifest["desktop"] | AboutAssetManifest["mobile"];
    readonly plane: {
      readonly desktopWidth: number;
      readonly mobileWidth: number;
      readonly maxViewportWidthRatio: number;
      readonly opacity: number;
      readonly z: number;
    };
  };
  readonly motion: {
    readonly minimumRecognizableOpacity: number;
    readonly stagePoses: readonly [
      AboutPortraitStagePose,
      AboutPortraitStagePose,
      AboutPortraitStagePose,
      AboutPortraitStagePose,
    ];
    readonly responsive: {
      readonly mobileTranslateXMultiplier: number;
      readonly mobileTranslateYMultiplier: number;
    };
  };
  readonly cameraIntent: {
    readonly stagePoses: readonly [
      AboutCameraIntentStagePose,
      AboutCameraIntentStagePose,
      AboutCameraIntentStagePose,
      AboutCameraIntentStagePose,
    ];
    readonly fovIntent: number;
    readonly depthBias: number;
    readonly weight: number;
  };
};

const desktopPortraitAsset = {
  id: `${aboutAssetManifest.assetId}:desktop`,
  src: aboutAssetManifest.desktop.path,
} as const;
const mobilePortraitAsset = {
  id: `${aboutAssetManifest.assetId}:mobile`,
  src: aboutAssetManifest.mobile.path,
} as const;

export const aboutSceneConfig: AboutSceneConfig = {
  id: ABOUT_SCENE_ID,
  anchorId: ABOUT_SCENE_ANCHOR_ID,
  portraitAnchorId: ABOUT_PORTRAIT_ANCHOR_ID,
  mobileBreakpoint: aboutAssetManifest.mobileBreakpoint,
  portrait: {
    assetId: aboutAssetManifest.assetId,
    status: aboutAssetManifest.status,
    identity: aboutAssetManifest.identity,
    assetSources: {
      desktop: aboutAssetManifest.desktop.path,
      mobile: aboutAssetManifest.mobile.path,
    },
    assets: {
      desktop: desktopPortraitAsset,
      mobile: mobilePortraitAsset,
    },
    selectAssetSource: selectAboutPortraitSource,
    selectAsset(viewportWidth: number): AboutPortraitResponsiveAsset {
      return selectAboutPortraitSource(viewportWidth) === mobilePortraitAsset.src
        ? mobilePortraitAsset
        : desktopPortraitAsset;
    },
    selectVariant(viewportWidth: number) {
      return selectAboutPortraitSource(viewportWidth) === mobilePortraitAsset.src
        ? aboutAssetManifest.mobile
        : aboutAssetManifest.desktop;
    },
    plane: {
      desktopWidth: 420,
      mobileWidth: 300,
      maxViewportWidthRatio: 0.72,
      opacity: 1,
      z: 0,
    },
  },
  motion: {
    minimumRecognizableOpacity: 0.96,
    stagePoses: [
      {
        translateX: 0,
        translateY: 0,
        scale: 1,
        opacity: 1,
        colorMultiplier: 0.94,
      },
      {
        translateX: 8,
        translateY: -4,
        scale: 1.01,
        opacity: 0.98,
        colorMultiplier: 0.98,
      },
      {
        translateX: 14,
        translateY: -8,
        scale: 1.02,
        opacity: 1,
        colorMultiplier: 1,
      },
      {
        translateX: 20,
        translateY: -10,
        scale: 1.02,
        opacity: 0.98,
        colorMultiplier: 0.99,
      },
    ],
    responsive: {
      mobileTranslateXMultiplier: 0.7,
      mobileTranslateYMultiplier: 0.8,
    },
  },
  cameraIntent: {
    stagePoses: [
      {
        targetOffset: { x: 0, y: 0, z: 0 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
      },
      {
        targetOffset: { x: 0.01, y: -0.01, z: 0 },
        positionOffset: { x: -0.01, y: 0, z: 0.35 },
      },
      {
        targetOffset: { x: 0.02, y: -0.01, z: 0 },
        positionOffset: { x: -0.02, y: 0.01, z: 0.35 },
      },
      {
        targetOffset: { x: 0.03, y: -0.02, z: 0 },
        positionOffset: { x: -0.03, y: 0.01, z: 0.35 },
      },
    ],
    fovIntent: 48,
    depthBias: -0.15,
    weight: 1,
  },
};
