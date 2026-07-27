import heroManifest from "../../../../public/assets/hero/hero-manifest.json";

type HeroPortraitSource = {
  readonly desktop: string;
  readonly mobile: string;
};

type HeroUVRect = {
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
};

type HeroForegroundCropConfig = {
  readonly enabled: boolean;
  readonly sourceTexture: string;
  readonly uvOrigin: "top-left";
  readonly scaleMultiplier: number;
  readonly uvRects: {
    readonly desktop: HeroUVRect;
    readonly mobile: HeroUVRect;
  };
  readonly selectUvRect: (viewportWidth: number) => HeroUVRect;
  readonly regionName: string;
};

type HeroCameraIntentConfig = {
  readonly targetOffset: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly positionOffset: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly fovIntent: number;
  readonly depthBias: number;
  readonly weight: number;
};

type HeroDepartPose = {
  readonly progress: number;
  readonly translation: {
    readonly x: number;
    readonly y: number;
  };
  readonly opacity: number;
  readonly scale: number;
};

const HERO_PORTRAIT_MOBILE_BREAKPOINT = 768;
const HERO_FOREGROUND_UV_ORIGIN = "top-left" as const;

export const HERO_SCENE_ID = "hero-scene";
export const HERO_SCENE_ANCHOR_ID = "hero";
export const HERO_PORTRAIT_ASSET_ID = "hero-portrait";
const HERO_MOTION_THRESHOLDS = {
  enter: 0.15,
  hold: 0.55,
  reducedMotionProgress: 0.5,
} as const;

export const HERO_MOTION_CONFIG = {
  thresholds: {
    enter: HERO_MOTION_THRESHOLDS.enter,
    hold: HERO_MOTION_THRESHOLDS.hold,
    reducedMotionProgress: HERO_MOTION_THRESHOLDS.reducedMotionProgress,
  },
  opacity: {
    enterStart: 0.12,
    base: 1,
    hold: 1,
    departEnd: 0,
  },
  scale: {
    enterStart: 0.86,
    base: 1,
    hold: 1,
    departEnd: 0.92,
  },
  translation: {
    enter: {
      x: -36,
      y: -24,
    },
    hold: {
      x: 0,
      y: 0,
    },
    depart: {
      x: 56,
      y: 20,
    },
  },
  depart: {
    keyframes: [
      {
        progress: 0.55,
        translation: {
          x: 0,
          y: 0,
        },
        opacity: 1,
        scale: 1,
      },
      {
        progress: 0.65,
        translation: {
          x: 6,
          y: 2,
        },
        opacity: 0.92,
        scale: 0.995,
      },
      {
        progress: 0.75,
        translation: {
          x: 26,
          y: 10,
        },
        opacity: 0.55,
        scale: 0.97,
      },
      {
        progress: 0.85,
        translation: {
          x: 50,
          y: 18,
        },
        opacity: 0.12,
        scale: 0.93,
      },
      {
        progress: 0.9,
        translation: {
          x: 56,
          y: 20,
        },
        opacity: 0,
        scale: 0.92,
      },
    ] as const satisfies readonly HeroDepartPose[],
  },
  foreground: {
    translateMultiplier: 1.35,
    scaleMultiplier: 1.06,
    renderScaleMultiplier: 1,
  },
  easing: {
    enter: "easeOutCubic",
    depart: "easeInOutCubic",
  },
} as const;

export const CHAPTER_PROGRESS_CONFIG = {
  phaseBoundaries: {
    enterMax: HERO_MOTION_CONFIG.thresholds.enter,
    holdMax: HERO_MOTION_CONFIG.thresholds.hold,
  },
  reducedMotionProgress: HERO_MOTION_CONFIG.thresholds.reducedMotionProgress,
} as const;

function selectPortraitSource(width: number): string {
  if (Number.isFinite(width) && width > 0 && width <= HERO_PORTRAIT_MOBILE_BREAKPOINT) {
    return heroManifest.mobile.path;
  }
  return heroManifest.desktop.path;
}

function selectForegroundUvRect(width: number): HeroUVRect {
  const source =
    Number.isFinite(width) && width > 0 && width <= HERO_PORTRAIT_MOBILE_BREAKPOINT
      ? heroManifest.foregroundCrop.uvRect.mobile
      : heroManifest.foregroundCrop.uvRect.desktop;

  return {
    uMin: source.uMin,
    uMax: source.uMax,
    vMin: source.vMin,
    vMax: source.vMax,
  };
}

function resolveForegroundUvOrigin(value: string): "top-left" {
  if (value !== HERO_FOREGROUND_UV_ORIGIN) {
    throw new Error(`Unsupported Hero foreground UV origin: ${value}`);
  }

  return value;
}

export const heroSceneConfig = {
  id: HERO_SCENE_ID,
  anchorId: HERO_SCENE_ANCHOR_ID,
  portraitAssetId: HERO_PORTRAIT_ASSET_ID,
  portraitAssetSources: {
    desktop: heroManifest.desktop.path,
    mobile: heroManifest.mobile.path,
  } as const satisfies HeroPortraitSource,
  selectPortraitAssetSrc: selectPortraitSource,
  portrait: {
    width: 1.65,
    height: 2.2,
    depth: 1.65,
  },
  parallax: {
    maxTranslateX: 20,
    maxTranslateY: 14,
    maxRotateX: 7,
    maxRotateY: 9,
    damp: 10,
  },
  foreground: {
    enabled: heroManifest.foregroundCrop.enabled,
    sourceTexture: heroManifest.foregroundCrop.sourceTexture,
    uvOrigin: resolveForegroundUvOrigin(heroManifest.foregroundCrop.uvOrigin),
    scaleMultiplier: HERO_MOTION_CONFIG.foreground.renderScaleMultiplier,
    uvRects: {
      desktop: selectForegroundUvRect(HERO_PORTRAIT_MOBILE_BREAKPOINT + 1),
      mobile: selectForegroundUvRect(HERO_PORTRAIT_MOBILE_BREAKPOINT),
    },
    selectUvRect: selectForegroundUvRect,
    regionName: heroManifest.foregroundCrop.region.name,
  } as const satisfies HeroForegroundCropConfig,
  cameraIntent: {
    targetOffset: {
      x: 0,
      y: 0,
      z: 0,
    },
    positionOffset: {
      x: -0.08,
      y: -0.02,
      z: 0.35,
    },
    fovIntent: 48,
    depthBias: -0.2,
    weight: 1,
  } as const satisfies HeroCameraIntentConfig,
} as const;

export type HeroSceneConfig = typeof heroSceneConfig;
