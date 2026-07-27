import type AssetRegistry from "@/lib/webgl/AssetRegistry";

type HeroPortraitState = {
  readonly isReady: boolean;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly hasTransparency: boolean;
  readonly width: number | null;
  readonly height: number | null;
};

export default class HeroPortrait {
  private loading = false;
  private loaded = false;
  private error: string | null = null;
  private transparent = true;
  private naturalWidth: number | null = null;
  private naturalHeight: number | null = null;
  private src: string | null = null;

  constructor(
    readonly assetId: string,
  ) {}

  get state(): HeroPortraitState {
    return {
      isReady: this.loaded,
      isLoading: this.loading,
      hasError: this.error !== null,
      hasTransparency: this.transparent,
      width: this.naturalWidth,
      height: this.naturalHeight,
    };
  }

  setSource(nextSrc: string): void {
    if (this.src === nextSrc) {
      return;
    }
    this.src = nextSrc;
    this.loaded = false;
    this.loading = false;
    this.error = null;
    this.naturalWidth = null;
    this.naturalHeight = null;
  }

  async ensureLoaded(assetRegistry: AssetRegistry<HTMLImageElement>): Promise<void> {
    if (this.loaded || this.loading) {
      return;
    }

    if (!this.src) {
      this.error = "Portrait source is not configured.";
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      this.error = "Image loading requires browser context.";
      return;
    }

    if (!assetRegistry.has(this.assetId)) {
      assetRegistry.register({
        id: this.assetId,
        src: this.src,
        kind: "image",
        metadata: {
          transparent: true,
        },
      });
    }

    this.loading = true;
    this.error = null;

    try {
      await assetRegistry.preload(this.assetId, () => this.loadImage(this.src as string));
      this.loaded = true;
      this.loading = false;
    } catch (error) {
      this.loading = false;
      this.error = error instanceof Error ? error.message : "unknown";
      throw error;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = src;

      if (image.complete && image.naturalWidth > 0) {
        this.naturalWidth = image.naturalWidth;
        this.naturalHeight = image.naturalHeight;
        resolve(image);
        return;
      }

      image.onload = () => {
        this.naturalWidth = image.naturalWidth;
        this.naturalHeight = image.naturalHeight;
        resolve(image);
      };
      image.onerror = () => {
        reject(new Error(`Failed to load hero portrait "${src}".`));
      };
    });
  }
}
