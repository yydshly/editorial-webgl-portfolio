import type { MotionFramePayload } from "@/lib/motion/types";
import type { CameraIntent } from "@/lib/webgl/CameraIntent";

export type SceneIdentity = {
  readonly id: string;
  readonly anchorId?: string;
  readonly sceneType?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type SceneModuleSnapshot = {
  readonly isActive: boolean;
  readonly isCached: boolean;
  readonly isDisposed: boolean;
};

export interface SceneModule<TSnapshot = SceneModuleSnapshot> {
  readonly identity: SceneIdentity;

  preload(): Promise<void> | void;

  activate(): boolean;

  update(payload: MotionFramePayload): void;

  deactivate(): boolean;

  dispose(): void;

  getSnapshot(): Readonly<TSnapshot>;

  getCameraIntent?(): Readonly<CameraIntent> | null;
}
