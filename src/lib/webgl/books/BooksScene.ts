import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import type { MotionFramePayload } from "@/lib/motion/types";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import type GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { SceneIdentity, SceneModule } from "@/lib/webgl/SceneModule";
import { resolveBooksChapterProgress } from "@/lib/webgl/books/BooksChapterProgress";
import {
  resolveBooksCoverMotion,
  type BooksCoverMotion,
} from "@/lib/webgl/books/BooksSceneMotion";
import {
  booksAssetManifest,
  type BooksCoverAsset,
  type BooksCoverRole,
} from "@/lib/webgl/books/booksAssetManifest";
import {
  BOOKS_COVER_STAGE_ANCHOR_ID,
  BOOKS_CAMERA_INTENT_CONFIG,
  BOOKS_MOBILE_BREAKPOINT,
  BOOKS_SCENE_ANCHOR_ID,
  BOOKS_SCENE_ID,
  getBooksCoverAssetId,
  getBooksCoverTextureOwnerId,
} from "@/lib/webgl/books/booksSceneConfig";

export type BooksCoverAssetState = {
  readonly id: string;
  readonly role: BooksCoverRole;
  readonly assetId: string;
  readonly assetSource: string;
  readonly assetStatus: "development" | "production";
  readonly isAssetReady: boolean;
};

type BooksAnchorPoint = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

type BooksAnchorViewportPoint = {
  readonly x: number;
  readonly y: number;
};

export type BooksSceneState = {
  readonly isActive: boolean;
  readonly isCached: boolean;
  readonly isDisposed: boolean;
  readonly isAnchored: boolean;
  readonly reducedMotion: boolean;
  readonly progress: number;
  readonly visualReady: boolean;
  readonly anchorWidth: number;
  readonly anchorHeight: number;
  readonly anchorViewport: BooksAnchorViewportPoint | null;
  readonly anchorWorld: BooksAnchorPoint | null;
  readonly covers: readonly [
    BooksCoverAssetState,
    BooksCoverAssetState,
    BooksCoverAssetState,
  ];
  readonly motion: BooksCoverMotion;
};

type BooksSceneOptions = {
  readonly anchorId?: string;
  readonly coverStageAnchorId?: string;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly domTracker: DOMTracker;
  readonly gpuResourceManager: GPUResourceManager;
  readonly snapshot: MotionSnapshotStore;
  readonly loadAsset?: (src: string) => Promise<HTMLImageElement>;
};

type ResponsiveViewport = "desktop" | "mobile";

export default class BooksScene implements SceneModule<BooksSceneState> {
  readonly identity: SceneIdentity;

  private readonly anchorId: string;
  private readonly coverStageAnchorId: string;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly domTracker: DOMTracker;
  private readonly gpuResourceManager: GPUResourceManager;
  private readonly snapshot: MotionSnapshotStore;
  private readonly loadAsset: (src: string) => Promise<HTMLImageElement>;
  private responsiveViewport: ResponsiveViewport;
  private coverStates: [
    BooksCoverAssetState,
    BooksCoverAssetState,
    BooksCoverAssetState,
  ];
  private preloadTask: Promise<void> | null = null;
  private active = false;
  private cached = true;
  private disposed = false;
  private state: BooksSceneState;

  constructor({
    anchorId = BOOKS_SCENE_ANCHOR_ID,
    coverStageAnchorId = BOOKS_COVER_STAGE_ANCHOR_ID,
    assetRegistry,
    domTracker,
    gpuResourceManager,
    snapshot,
    loadAsset,
  }: BooksSceneOptions) {
    this.anchorId = anchorId;
    this.coverStageAnchorId = coverStageAnchorId;
    this.assetRegistry = assetRegistry;
    this.domTracker = domTracker;
    this.gpuResourceManager = gpuResourceManager;
    this.snapshot = snapshot;
    this.loadAsset = loadAsset ?? loadImageAsset;
    this.responsiveViewport = this.resolveResponsiveViewport();
    this.identity = {
      id: BOOKS_SCENE_ID,
      anchorId: this.anchorId,
      sceneType: "books",
      metadata: {
        author: booksAssetManifest.author,
        series: booksAssetManifest.seriesLabel,
        assetStatus: booksAssetManifest.status,
      },
    };
    this.coverStates = this.createCoverStates(this.responsiveViewport);
    this.registerCoverStates(this.coverStates);

    const motion = this.snapshot.getSnapshot();
    this.state = {
      isActive: false,
      isCached: true,
      isDisposed: false,
      isAnchored: false,
      reducedMotion: motion.reducedMotion,
      progress: 0,
      visualReady: false,
      anchorWidth: 0,
      anchorHeight: 0,
      anchorViewport: null,
      anchorWorld: null,
      covers: cloneCoverTuple(this.coverStates),
      motion: resolveBooksCoverMotion({
        progress: 0,
        reducedMotion: motion.reducedMotion,
        viewportWidth: motion.viewport.width,
      }),
    };
  }

  preload(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }

    this.selectResponsiveCovers();
    return this.ensureCoversReady();
  }

  activate(): boolean {
    if (this.disposed) {
      return false;
    }

    this.active = true;
    this.cached = false;
    this.state = {
      ...this.state,
      isActive: true,
      isCached: false,
      isDisposed: false,
    };
    return true;
  }

  update(payload: MotionFramePayload): void {
    void payload;
    if (this.disposed || !this.active) {
      return;
    }

    this.selectResponsiveCovers();
    if (!this.coverStates.every((cover) => cover.isAssetReady)) {
      void this.ensureCoversReady();
    }

    const sectionAnchor = this.domTracker.getSnapshot(this.anchorId);
    const coverStageAnchor = this.domTracker.getSnapshot(
      this.coverStageAnchorId,
    );
    const motionSnapshot = this.snapshot.getSnapshot();
    const relativeScroll = sectionAnchor
      ? Math.max(
          0,
          motionSnapshot.viewport.height -
            sectionAnchor.worldTop.screen.y,
        )
      : undefined;
    const progress = resolveBooksChapterProgress({
      reducedMotion: motionSnapshot.reducedMotion,
      relativeScroll,
      viewportHeight: motionSnapshot.viewport.height,
      anchorHeight: sectionAnchor?.height,
    });
    const isAnchored =
      progress.isAnchored &&
      Boolean(sectionAnchor) &&
      Boolean(coverStageAnchor);

    this.state = {
      ...this.state,
      isActive: true,
      isCached: false,
      isDisposed: false,
      isAnchored,
      reducedMotion: motionSnapshot.reducedMotion,
      progress: progress.chapterProgress,
      anchorWidth: coverStageAnchor?.width ?? 0,
      anchorHeight: coverStageAnchor?.height ?? 0,
      anchorViewport: coverStageAnchor
        ? {
            x: coverStageAnchor.worldCenter.screen.x,
            y: coverStageAnchor.worldCenter.screen.y,
          }
        : null,
      anchorWorld: coverStageAnchor
        ? {
            x: coverStageAnchor.worldCenter.point.x,
            y: coverStageAnchor.worldCenter.point.y,
            z: coverStageAnchor.worldCenter.point.z,
          }
        : null,
      covers: cloneCoverTuple(this.coverStates),
      motion: resolveBooksCoverMotion({
        progress: progress.chapterProgress,
        reducedMotion: motionSnapshot.reducedMotion,
        viewportWidth: motionSnapshot.viewport.width,
      }),
    };
  }

  deactivate(): boolean {
    if (this.disposed) {
      return true;
    }

    this.active = false;
    this.cached = true;
    this.state = {
      ...this.state,
      isActive: false,
      isCached: true,
      isDisposed: false,
    };
    return true;
  }

  setVisualReady(ready: boolean): void {
    if (this.disposed) {
      return;
    }

    this.state = {
      ...this.state,
      visualReady: Boolean(ready),
    };
  }

  getCameraIntent(): Readonly<CameraIntent> | null {
    const anchorWorld = this.state.anchorWorld;
    if (
      !this.state.isActive ||
      this.state.isCached ||
      this.state.isDisposed ||
      !this.state.isAnchored ||
      !this.state.visualReady ||
      !anchorWorld
    ) {
      return null;
    }

    return {
      target: { ...anchorWorld },
      positionOffset: {
        ...BOOKS_CAMERA_INTENT_CONFIG.positionOffset,
      },
      fovIntent: BOOKS_CAMERA_INTENT_CONFIG.fovIntent,
      depthBias: BOOKS_CAMERA_INTENT_CONFIG.depthBias,
      weight: BOOKS_CAMERA_INTENT_CONFIG.weight,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.active = false;
    this.cached = false;
    this.disposed = true;
    for (const cover of this.coverStates) {
      this.assetRegistry.release(this.identity.id, cover.assetId);
    }
    this.gpuResourceManager.releaseOwner(this.identity.id);
    for (const cover of booksAssetManifest.covers) {
      this.gpuResourceManager.releaseOwner(
        getBooksCoverTextureOwnerId(cover.id),
      );
    }
    this.preloadTask = null;
    this.coverStates = this.coverStates.map((cover) => ({
      ...cover,
      isAssetReady: false,
    })) as typeof this.coverStates;
    this.state = {
      ...this.state,
      isActive: false,
      isCached: false,
      isDisposed: true,
      visualReady: false,
      covers: cloneCoverTuple(this.coverStates),
    };
  }

  getSnapshot(): Readonly<BooksSceneState> {
    return {
      ...this.state,
      anchorViewport: this.state.anchorViewport
        ? { ...this.state.anchorViewport }
        : null,
      anchorWorld: this.state.anchorWorld
        ? { ...this.state.anchorWorld }
        : null,
      covers: cloneCoverTuple(this.state.covers),
      motion: cloneMotion(this.state.motion),
    };
  }

  private resolveResponsiveViewport(): ResponsiveViewport {
    const width = this.snapshot.viewport.width;
    return Number.isFinite(width) &&
      width > 0 &&
      width <= BOOKS_MOBILE_BREAKPOINT
      ? "mobile"
      : "desktop";
  }

  private selectResponsiveCovers(): void {
    const nextViewport = this.resolveResponsiveViewport();
    if (nextViewport === this.responsiveViewport) {
      return;
    }

    for (const cover of this.coverStates) {
      this.assetRegistry.release(this.identity.id, cover.assetId);
      this.gpuResourceManager.releaseOwner(
        getBooksCoverTextureOwnerId(cover.id),
      );
    }

    this.responsiveViewport = nextViewport;
    this.preloadTask = null;
    this.coverStates = this.createCoverStates(nextViewport);
    this.registerCoverStates(this.coverStates);
    this.state = {
      ...this.state,
      visualReady: false,
      covers: cloneCoverTuple(this.coverStates),
    };
  }

  private createCoverStates(
    viewport: ResponsiveViewport,
  ): [
    BooksCoverAssetState,
    BooksCoverAssetState,
    BooksCoverAssetState,
  ] {
    return booksAssetManifest.covers.map((cover) =>
      this.createCoverState(cover, viewport),
    ) as [
      BooksCoverAssetState,
      BooksCoverAssetState,
      BooksCoverAssetState,
    ];
  }

  private createCoverState(
    cover: BooksCoverAsset,
    viewport: ResponsiveViewport,
  ): BooksCoverAssetState {
    const variant = cover[viewport];
    const assetId = getBooksCoverAssetId(cover.id, viewport);
    return {
      id: cover.id,
      role: cover.visualRole,
      assetId,
      assetSource: variant.path,
      assetStatus: cover.status,
      isAssetReady:
        this.assetRegistry.getState(assetId) === "ready" &&
        Boolean(this.assetRegistry.getData(assetId)),
    };
  }

  private registerCoverStates(
    covers: readonly [
      BooksCoverAssetState,
      BooksCoverAssetState,
      BooksCoverAssetState,
    ],
  ): void {
    for (const cover of covers) {
      const existing = this.assetRegistry.get(cover.assetId);
      if (existing && existing.src !== cover.assetSource) {
        throw new Error(
          `Books cover asset "${cover.assetId}" is already registered with a different source.`,
        );
      }
      if (!existing) {
        this.assetRegistry.register({
          id: cover.assetId,
          src: cover.assetSource,
          kind: "image",
          metadata: {
            assetStatus: cover.assetStatus,
            bookId: cover.id,
            role: cover.role,
            scene: this.identity.id,
          },
        });
      }
    }
  }

  private ensureCoversReady(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    if (this.preloadTask) {
      return this.preloadTask;
    }

    const coversAtStart = cloneCoverTuple(this.coverStates);
    const task = Promise.all(
      coversAtStart.map(async (cover) => {
        if (
          this.assetRegistry.getState(cover.assetId) !== "ready" ||
          !this.assetRegistry.getData(cover.assetId)
        ) {
          await this.assetRegistry.preload(
            cover.assetId,
            () => this.loadAsset(cover.assetSource),
          );
        }
      }),
    ).then(() => {
      const currentIds = this.coverStates.map((cover) => cover.assetId);
      const loadedIds = coversAtStart.map((cover) => cover.assetId);
      if (
        this.disposed ||
        !currentIds.every((id, index) => id === loadedIds[index])
      ) {
        return;
      }

      this.coverStates = this.coverStates.map((cover) => {
        const ready =
          this.assetRegistry.getState(cover.assetId) === "ready" &&
          Boolean(this.assetRegistry.getData(cover.assetId));
        if (ready) {
          this.assetRegistry.acquire(this.identity.id, cover.assetId);
        }
        return {
          ...cover,
          isAssetReady: ready,
        };
      }) as typeof this.coverStates;
      this.state = {
        ...this.state,
        covers: cloneCoverTuple(this.coverStates),
      };
    });

    this.preloadTask = task;
    void task.catch(() => {
      if (this.preloadTask === task) {
        this.preloadTask = null;
      }
    });
    return task;
  }
}

function cloneCoverTuple(
  covers: readonly [
    BooksCoverAssetState,
    BooksCoverAssetState,
    BooksCoverAssetState,
  ],
): [
  BooksCoverAssetState,
  BooksCoverAssetState,
  BooksCoverAssetState,
] {
  return covers.map((cover) => ({ ...cover })) as [
    BooksCoverAssetState,
    BooksCoverAssetState,
    BooksCoverAssetState,
  ];
}

function cloneMotion(motion: BooksCoverMotion): BooksCoverMotion {
  return {
    primary: { ...motion.primary },
    "secondary-left": { ...motion["secondary-left"] },
    "secondary-right": { ...motion["secondary-right"] },
  };
}

function loadImageAsset(src: string): Promise<HTMLImageElement> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.reject(new Error(`Failed to load Books cover "${src}".`));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load Books cover "${src}".`));
    image.src = src;
  });
}
