import type { BooksCompositionSnapshot } from "@/lib/webgl/books/BooksCompositionSnapshot";

export type WebGLCompositionVector = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type WebGLCameraCompositionSnapshot = {
  readonly position: WebGLCompositionVector;
  readonly target: WebGLCompositionVector;
  readonly fov: number;
};

export type WebGLLayerCompositionSnapshot = {
  readonly rendered: boolean;
  readonly visible: boolean;
  readonly frustumVisible: boolean;
  readonly opacity?: number;
  readonly position: WebGLCompositionVector;
  readonly scale: WebGLCompositionVector;
  readonly ndc: WebGLCompositionVector;
  readonly ndcBounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
  readonly screen?: {
    readonly center: {
      readonly x: number;
      readonly y: number;
    };
    readonly bounds: {
      readonly left: number;
      readonly right: number;
      readonly top: number;
      readonly bottom: number;
    };
  };
};

export type WebGLAnchorProjectionSnapshot = {
  readonly anchorRectCenter: {
    readonly x: number;
    readonly y: number;
  } | null;
  readonly expectedScreenCenter: {
    readonly x: number;
    readonly y: number;
  } | null;
  readonly projectedScreenCenter: {
    readonly x: number;
    readonly y: number;
  } | null;
  readonly deltaPx: {
    readonly x: number;
    readonly y: number;
  } | null;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
};

export type WebGLTextureSamplingSnapshot = {
  readonly source: string | null;
  readonly decodedWidth: number;
  readonly decodedHeight: number;
  readonly minFilter: string | null;
  readonly magFilter: string | null;
  readonly generateMipmaps: boolean | null;
  readonly anisotropy: number | null;
  readonly colorSpace: string | null;
  readonly premultiplyAlpha: boolean | null;
  readonly flipY: boolean | null;
};

export type WebGLHeroLayerMotionSnapshot = {
  readonly translateX: number;
  readonly translateY: number;
  readonly rotateX: number;
  readonly rotateY: number;
  readonly opacity: number;
  readonly scale: number;
};

export type WebGLHeroForegroundCropSnapshot = {
  readonly sourceTextureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly cropPixels: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly uvRect: {
    readonly uMin: number;
    readonly uMax: number;
    readonly vMin: number;
    readonly vMax: number;
  };
  readonly uvOriginConvention: "top-left";
  readonly textureFlipY: boolean;
  readonly geometryAspect: number;
  readonly responsiveAssetSource: string | null;
  readonly cropNormalizedCenter: {
    readonly x: number;
    readonly y: number;
  };
  readonly cropPixelAspect: number;
  readonly portraitMotionTransform: WebGLHeroLayerMotionSnapshot;
  readonly foregroundMotionTransform: WebGLHeroLayerMotionSnapshot;
  readonly foregroundZ: number;
  readonly registration: {
    readonly portraitWorldMatrix: readonly number[];
    readonly foregroundWorldMatrix: readonly number[];
    readonly portraitParentWorldMatrix: readonly number[] | null;
    readonly foregroundParentWorldMatrix: readonly number[] | null;
    readonly expectedScreenRect: {
      readonly left: number;
      readonly right: number;
      readonly top: number;
      readonly bottom: number;
      readonly center: {
        readonly x: number;
        readonly y: number;
      };
      readonly width: number;
      readonly height: number;
    };
    readonly actualScreenRect: {
      readonly left: number;
      readonly right: number;
      readonly top: number;
      readonly bottom: number;
      readonly center: {
        readonly x: number;
        readonly y: number;
      };
      readonly width: number;
      readonly height: number;
    };
    readonly centerResidual: {
      readonly x: number;
      readonly y: number;
    };
    readonly sizeResidualPercent: {
      readonly width: number;
      readonly height: number;
    };
    readonly depthScale: number;
    readonly foregroundLocalPosition: WebGLCompositionVector;
    readonly foregroundLocalScale: WebGLCompositionVector;
    readonly camera: {
      readonly position: WebGLCompositionVector;
      readonly forward: WebGLCompositionVector;
      readonly fov: number;
    };
  } | null;
};

export type WebGLCompositionSnapshot = {
  readonly rendererOwner: "global-webgl-stage";
  readonly camera: WebGLCameraCompositionSnapshot;
  readonly hero: {
    readonly portrait: WebGLLayerCompositionSnapshot;
    readonly foreground: WebGLLayerCompositionSnapshot | null;
    readonly foregroundCrop?: WebGLHeroForegroundCropSnapshot | null;
  };
  readonly media: {
    readonly main: WebGLLayerCompositionSnapshot;
    readonly secondary: WebGLLayerCompositionSnapshot;
    readonly textureSampling?: {
      readonly main: WebGLTextureSamplingSnapshot;
      readonly secondary: WebGLTextureSamplingSnapshot;
    };
    readonly projection?: {
      readonly main: WebGLAnchorProjectionSnapshot;
      readonly secondary: WebGLAnchorProjectionSnapshot;
    };
  };
  readonly about?: {
    readonly portrait: WebGLLayerCompositionSnapshot;
    readonly projection: WebGLAnchorProjectionSnapshot;
    readonly meshCount: 1;
    readonly materialSide: number;
  } | null;
  readonly books?: BooksCompositionSnapshot | null;
};
