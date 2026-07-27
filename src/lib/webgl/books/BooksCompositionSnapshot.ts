import type {
  WebGLAnchorProjectionSnapshot,
  WebGLLayerCompositionSnapshot,
} from "@/lib/webgl/WebGLCompositionSnapshot";
import type { BooksCoverMotion } from "@/lib/webgl/books/BooksSceneMotion";
import type { BooksCoverRole } from "@/lib/webgl/books/booksAssetManifest";

export type BooksCompositionSnapshot = {
  readonly covers: readonly [
    WebGLLayerCompositionSnapshot,
    WebGLLayerCompositionSnapshot,
    WebGLLayerCompositionSnapshot,
  ];
  readonly projections: readonly [
    WebGLAnchorProjectionSnapshot,
    WebGLAnchorProjectionSnapshot,
    WebGLAnchorProjectionSnapshot,
  ];
  readonly roleOrder: readonly [
    BooksCoverRole,
    BooksCoverRole,
    BooksCoverRole,
  ];
  readonly textureSources: readonly [string | null, string | null, string | null];
  readonly meshCount: 3;
  readonly geometryCount: 1;
  readonly materialCount: 3;
  readonly textureCount: number;
  readonly expectedDrawCalls: 3;
  readonly allTexturesReady: boolean;
  readonly allCoversRendered: boolean;
  readonly materialSides: readonly [number, number, number];
  readonly depthWrites: readonly [boolean, boolean, boolean];
  readonly motion: BooksCoverMotion;
  readonly supportingVisibility: {
    readonly leftExposedFraction: number;
    readonly rightExposedFraction: number;
  };
};
