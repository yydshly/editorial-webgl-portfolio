import type { BooksCoverRole } from "./booksAssetManifest";

export const BOOKS_SCENE_ID = "books-scene";
export const BOOKS_SCENE_ANCHOR_ID = "books";
export const BOOKS_COVER_STAGE_ANCHOR_ID = "books-cover-stage";
export const BOOKS_COVER_GEOMETRY_RESOURCE_ID =
  `${BOOKS_SCENE_ID}:cover-geometry`;

export const BOOKS_MOBILE_BREAKPOINT = 768;

export const BOOKS_PHASE_BOUNDARIES = {
  enterMax: 0.3,
  holdMax: 0.72,
} as const;

export const BOOKS_REDUCED_MOTION_PROGRESS = 0.51;

export const BOOKS_CAMERA_INTENT_CONFIG = {
  positionOffset: { x: 0, y: 0, z: 0.35 },
  fovIntent: 48,
  depthBias: -0.15,
  weight: 1,
} as const;

export const BOOKS_ENTER_DELAYS: Readonly<
  Record<BooksCoverRole, number>
> = {
  primary: 0,
  "secondary-left": 0.18,
  "secondary-right": 0.28,
};

export function getBooksCoverAssetId(
  coverId: string,
  viewport: "desktop" | "mobile",
): string {
  return `${coverId}:${viewport}`;
}

export function getBooksCoverTextureOwnerId(coverId: string): string {
  return `${BOOKS_SCENE_ID}:${coverId}:cover-texture`;
}

export function getBooksCoverMaterialResourceId(
  coverId: string,
): string {
  return `${BOOKS_SCENE_ID}:${coverId}:cover-material`;
}

export type BookCoverPose = {
  readonly visualRole: BooksCoverRole;
  readonly translateX: number;
  readonly translateY: number;
  readonly scale: number;
  readonly opacity: number;
  readonly depthOffsetPx: number;
};

export type BooksCoverMotion = Readonly<
  Record<BooksCoverRole, BookCoverPose>
>;

type BooksMotionViewportConfig = {
  readonly enter: BooksCoverMotion;
  readonly hold: BooksCoverMotion;
  readonly depart: BooksCoverMotion;
};

export const booksSceneMotionConfig: Readonly<{
  desktop: BooksMotionViewportConfig;
  mobile: BooksMotionViewportConfig;
}> = {
  desktop: {
    enter: {
      primary: {
        visualRole: "primary",
        translateX: 0,
        translateY: 14,
        scale: 0.98,
        opacity: 1,
        depthOffsetPx: 0,
      },
      "secondary-left": {
        visualRole: "secondary-left",
        translateX: -72,
        translateY: 48,
        scale: 0.78,
        opacity: 0.68,
        depthOffsetPx: -14,
      },
      "secondary-right": {
        visualRole: "secondary-right",
        translateX: 72,
        translateY: 54,
        scale: 0.76,
        opacity: 0.64,
        depthOffsetPx: -18,
      },
    },
    hold: {
      primary: {
        visualRole: "primary",
        translateX: 0,
        translateY: 0,
        scale: 1,
        opacity: 1,
        depthOffsetPx: 0,
      },
      "secondary-left": {
        visualRole: "secondary-left",
        translateX: -180,
        translateY: 28,
        scale: 0.82,
        opacity: 0.92,
        depthOffsetPx: -14,
      },
      "secondary-right": {
        visualRole: "secondary-right",
        translateX: 215,
        translateY: -90,
        scale: 0.74,
        opacity: 0.86,
        depthOffsetPx: -18,
      },
    },
    depart: {
      primary: {
        visualRole: "primary",
        translateX: 0,
        translateY: -32,
        scale: 0.96,
        opacity: 0.92,
        depthOffsetPx: 0,
      },
      "secondary-left": {
        visualRole: "secondary-left",
        translateX: -180,
        translateY: -4,
        scale: 0.7872,
        opacity: 0.82,
        depthOffsetPx: -14,
      },
      "secondary-right": {
        visualRole: "secondary-right",
        translateX: 215,
        translateY: -122,
        scale: 0.7104,
        opacity: 0.76,
        depthOffsetPx: -18,
      },
    },
  },
  mobile: {
    enter: {
      primary: {
        visualRole: "primary",
        translateX: 0,
        translateY: 12,
        scale: 0.98,
        opacity: 1,
        depthOffsetPx: 0,
      },
      "secondary-left": {
        visualRole: "secondary-left",
        translateX: -36,
        translateY: 38,
        scale: 0.74,
        opacity: 0.68,
        depthOffsetPx: -10,
      },
      "secondary-right": {
        visualRole: "secondary-right",
        translateX: 36,
        translateY: 42,
        scale: 0.72,
        opacity: 0.64,
        depthOffsetPx: -12,
      },
    },
    hold: {
      primary: {
        visualRole: "primary",
        translateX: 0,
        translateY: 0,
        scale: 1,
        opacity: 1,
        depthOffsetPx: 0,
      },
      "secondary-left": {
        visualRole: "secondary-left",
        translateX: -86,
        translateY: 20,
        scale: 0.76,
        opacity: 0.92,
        depthOffsetPx: -10,
      },
      "secondary-right": {
        visualRole: "secondary-right",
        translateX: 117,
        translateY: -72,
        scale: 0.68,
        opacity: 0.86,
        depthOffsetPx: -12,
      },
    },
    depart: {
      primary: {
        visualRole: "primary",
        translateX: 0,
        translateY: -24,
        scale: 0.97,
        opacity: 0.93,
        depthOffsetPx: 0,
      },
      "secondary-left": {
        visualRole: "secondary-left",
        translateX: -86,
        translateY: -4,
        scale: 0.7296,
        opacity: 0.82,
        depthOffsetPx: -10,
      },
      "secondary-right": {
        visualRole: "secondary-right",
        translateX: 117,
        translateY: -96,
        scale: 0.6528,
        opacity: 0.76,
        depthOffsetPx: -12,
      },
    },
  },
};
