import type { CameraRigBreakpoint, CameraRigWorldPoint } from "@/lib/webgl/CameraRig";

export type DOMToWorldViewport = {
  readonly width: number;
  readonly height: number;
};

export type DOMToWorldCamera = {
  readonly fov: number;
  readonly distance: number;
};

export type DOMToWorldInput = {
  readonly x: number;
  readonly y: number;
  readonly viewport: DOMToWorldViewport;
  readonly camera: DOMToWorldCamera;
  readonly depth?: number;
};

export type DOMToWorldResult = {
  readonly world: CameraRigWorldPoint;
  readonly normalized: {
    readonly x: number;
    readonly y: number;
  };
  readonly breakpoint: CameraRigBreakpoint;
};

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1200;

function normalizeX(width: number, x: number): number {
  if (width <= 0) return 0;
  return (x / width) * 2 - 1;
}

function normalizeY(height: number, y: number): number {
  if (height <= 0) return 0;
  return 1 - (y / height) * 2;
}

function resolveBreakpoint(width: number): CameraRigBreakpoint {
  if (width < MOBILE_BREAKPOINT) {
    return "mobile";
  }
  if (width < TABLET_BREAKPOINT) {
    return "tablet";
  }
  return "desktop";
}

export function domToWorld(
  input: DOMToWorldInput,
): DOMToWorldResult {
  const width = input.viewport.width;
  const height = input.viewport.height;
  const normalized = {
    x: normalizeX(width, input.x),
    y: normalizeY(height, input.y),
  };
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const depth = input.depth ?? input.camera.distance;
  const halfHeight = Math.tan((input.camera.fov * Math.PI) / 360) * Math.max(
    0.0001,
    Math.abs(depth),
  );
  const halfWidth = halfHeight * aspect;

  return {
    world: {
      x: normalized.x * halfWidth,
      y: normalized.y * halfHeight,
      z: -Math.abs(depth),
    },
    normalized,
    breakpoint: resolveBreakpoint(width),
  };
}
