import * as THREE from "three";

import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import type { WebGLCameraCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";

export type CameraPerspectiveConfig = {
  readonly fov: number;
  readonly distance: number;
};

export type CameraRigViewport = {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
};

export type CameraRigBreakpoint = "mobile" | "tablet" | "desktop";

export type CameraRigState = {
  readonly fov: number;
  readonly distance: number;
  readonly viewport: CameraRigViewport;
  readonly aspect: number;
  readonly breakpoint: CameraRigBreakpoint;
};

export type CameraRigWorldPoint = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type CameraRigIntentOptions = {
  readonly immediate?: boolean;
};

type CameraRigOptions = {
  readonly perspective?: Partial<CameraPerspectiveConfig>;
  readonly defaultBreakpoint?: CameraRigBreakpoint;
  readonly transitionSpeed?: number;
};

const DEFAULT_PERSPECTIVE: CameraPerspectiveConfig = {
  fov: 48,
  distance: 8,
};

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1200;
const DEFAULT_TRANSITION_SPEED = 10;
const CAMERA_INTENT_WEIGHT_EPSILON = 0.0001;
const CAMERA_INTENT_WEIGHT_FLOOR = 0.25;
const CAMERA_INTENT_WEIGHT_CEIL = 2.5;
const MIN_CAMERA_DISTANCE = 0.0001;
const MIN_DELTA_TIME = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveSmoothFactor(deltaSeconds: number, weight: number, speed: number): number {
  const normalizedSpeed = clamp(speed, 1, 50);
  const normalizedWeight = clamp(
    Number.isFinite(weight) ? weight : CAMERA_INTENT_WEIGHT_EPSILON,
    CAMERA_INTENT_WEIGHT_FLOOR,
    CAMERA_INTENT_WEIGHT_CEIL,
  );
  const delta = Math.max(MIN_DELTA_TIME, deltaSeconds);
  return 1 - Math.exp(-normalizedSpeed * normalizedWeight * delta);
}

function getBreakpoint(width: number): CameraRigBreakpoint {
  if (width < MOBILE_BREAKPOINT) {
    return "mobile";
  }
  if (width < TABLET_BREAKPOINT) {
    return "tablet";
  }
  return "desktop";
}

export default class CameraRig {
  private readonly perspective: CameraPerspectiveConfig;
  private readonly transitionSpeed: number;
  private readonly cameraInstance: THREE.PerspectiveCamera;
  private readonly intentTarget = new THREE.Vector3(0, 0, 0);
  private intent: CameraIntent | null = null;
  private viewportState: CameraRigViewport = {
    width: 0,
    height: 0,
    devicePixelRatio: 1,
  };
  private aspect = 1;
  private breakpoint: CameraRigBreakpoint = "desktop";
  private isIntentAnchored = false;
  private snapOnNextUpdate = false;

  constructor(options: CameraRigOptions = {}) {
    this.perspective = {
      ...DEFAULT_PERSPECTIVE,
      ...options.perspective,
    };
    this.transitionSpeed =
      typeof options.transitionSpeed === "number" && Number.isFinite(options.transitionSpeed)
        ? Math.max(1, options.transitionSpeed)
        : DEFAULT_TRANSITION_SPEED;

    this.cameraInstance = new THREE.PerspectiveCamera(
      this.perspective.fov,
      1,
      0.1,
      1000,
    );
    this.cameraInstance.position.set(0, 0, this.perspective.distance);
    this.cameraInstance.lookAt(this.intentTarget);
    this.cameraInstance.updateProjectionMatrix();

    if (typeof window !== "undefined") {
      this.setViewport(
        window.innerWidth,
        window.innerHeight,
        window.devicePixelRatio ?? 1,
      );
      this.breakpoint = getBreakpoint(this.viewportState.width);
    } else {
      this.breakpoint = options.defaultBreakpoint ?? "desktop";
      this.updateAspect();
    }
  }

  get camera(): THREE.PerspectiveCamera {
    return this.cameraInstance;
  }

  setViewport(width: number, height: number, devicePixelRatio = 1): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
      return;
    }

    const nextWidth = Math.max(width, 1);
    const nextHeight = Math.max(height, 1);
    const nextDevicePixelRatio = Number.isFinite(devicePixelRatio)
      ? Math.max(1, devicePixelRatio)
      : 1;

    this.viewportState = {
      width: nextWidth,
      height: nextHeight,
      devicePixelRatio: nextDevicePixelRatio,
    };
    this.breakpoint = getBreakpoint(nextWidth);
    this.updateAspect();
    this.cameraInstance.aspect = this.aspect;
    this.cameraInstance.updateProjectionMatrix();
  }

  get state(): CameraRigState {
    return {
      fov: this.cameraInstance.fov,
      distance: this.cameraDistance,
      viewport: { ...this.viewportState },
      aspect: this.aspect,
      breakpoint: this.breakpoint,
    };
  }

  getPerspective(): Readonly<CameraPerspectiveConfig> {
    return {
      fov: this.cameraInstance.fov,
      distance: this.cameraDistance,
    };
  }

  getProjectionBaseline(): Readonly<CameraPerspectiveConfig> {
    return {
      fov: this.perspective.fov,
      distance: this.perspective.distance,
    };
  }

  setCameraIntent(value: CameraIntent | null, options: CameraRigIntentOptions = {}): void {
    this.intent = value
      ? {
        target: {
          x: value.target.x,
          y: value.target.y,
          z: value.target.z,
        },
        positionOffset: {
          x: value.positionOffset.x,
          y: value.positionOffset.y,
          z: value.positionOffset.z,
        },
        fovIntent: value.fovIntent,
        depthBias: value.depthBias,
        weight: value.weight,
      }
      : null;
    this.snapOnNextUpdate = Boolean(options.immediate && value);
  }

  get cameraIntent(): Readonly<CameraIntent> | null {
    if (!this.intent) {
      return null;
    }

    return {
      target: { ...this.intent.target },
      positionOffset: { ...this.intent.positionOffset },
      fovIntent: this.intent.fovIntent,
      depthBias: this.intent.depthBias,
      weight: this.intent.weight,
    };
  }

  get compositionSnapshot(): WebGLCameraCompositionSnapshot {
    return {
      position: {
        x: this.cameraInstance.position.x,
        y: this.cameraInstance.position.y,
        z: this.cameraInstance.position.z,
      },
      target: {
        x: this.intentTarget.x,
        y: this.intentTarget.y,
        z: this.intentTarget.z,
      },
      fov: this.cameraInstance.fov,
    };
  }

  update(deltaSeconds: number): void {
    if (!this.intent) {
      this.isIntentAnchored = false;
      return;
    }

    const t = resolveSmoothFactor(deltaSeconds, this.intent.weight, this.transitionSpeed);
    if (!Number.isFinite(t) || t <= 0) {
      return;
    }

    const intent = this.intent;
    const target = this.intentTarget;
    const desiredPosition = new THREE.Vector3(
      intent.target.x + intent.positionOffset.x,
      intent.target.y + intent.positionOffset.y,
      intent.target.z + intent.positionOffset.z,
    );

    target.set(intent.target.x, intent.target.y, intent.target.z);

    if (!this.isIntentAnchored || this.snapOnNextUpdate) {
      this.cameraInstance.position.copy(desiredPosition);
      this.intentTarget.copy(target);
      this.cameraInstance.fov = intent.fovIntent;
      this.cameraInstance.updateProjectionMatrix();
      this.cameraInstance.lookAt(this.intentTarget);
      this.isIntentAnchored = true;
      this.snapOnNextUpdate = false;
      return;
    }

    this.cameraInstance.position.lerp(desiredPosition, t);
    this.intentTarget.lerp(target, t);
    this.cameraInstance.lookAt(this.intentTarget);
    this.cameraInstance.fov = this.cameraInstance.fov + (intent.fovIntent - this.cameraInstance.fov) * t;
    this.cameraInstance.updateProjectionMatrix();
  }

  toWorld(
    x: number,
    y: number,
    depth = this.state.distance,
  ): CameraRigWorldPoint {
    const { width, height } = this.viewportState;
    const normalized = this.normalizedScreenCoords(x, y);

    if (width === 0 || height === 0 || !Number.isFinite(depth)) {
      return { x: 0, y: 0, z: -Math.abs(depth) };
    }

    const absDepth = Math.max(0.0001, Math.abs(depth));
    const halfHeight = Math.tan((this.cameraInstance.fov * Math.PI) / 360) * absDepth;
    const halfWidth = halfHeight * this.aspect;
    const worldX = normalized.x * halfWidth;
    const worldY = normalized.y * halfHeight;
    const worldZ = -absDepth;

    return {
      x: worldX,
      y: worldY,
      z: worldZ,
    };
  }

  get viewport(): CameraRigViewport {
    return { ...this.viewportState };
  }

  get currentBreakpoint(): CameraRigBreakpoint {
    return this.breakpoint;
  }

  private normalizedScreenCoords(x: number, y: number): { x: number; y: number } {
    const width = this.viewportState.width;
    const height = this.viewportState.height;

    if (width <= 0 || height <= 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: (x / width) * 2 - 1,
      y: 1 - (y / height) * 2,
    };
  }

  private updateAspect(): void {
    this.aspect = this.viewportState.width / this.viewportState.height;
  }

  private get cameraDistance(): number {
    const distance = this.cameraInstance.position.distanceTo(this.intentTarget);
    if (!Number.isFinite(distance) || distance <= MIN_CAMERA_DISTANCE) {
      return Math.max(MIN_CAMERA_DISTANCE, this.perspective.distance);
    }

    return distance;
  }
}
