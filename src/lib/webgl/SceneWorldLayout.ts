import * as THREE from "three";

export type SceneWorldPoint = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type SceneWorldCamera = {
  readonly fov: number;
  readonly near?: number;
  readonly position: SceneWorldPoint;
  readonly updateMatrixWorld?: () => void;
  readonly getWorldDirection?: (target: THREE.Vector3) => THREE.Vector3;
};

export type ScenePlaneWorldLayout = {
  readonly position: SceneWorldPoint;
  readonly scale: SceneWorldPoint;
  readonly worldUnitsPerPixel: number;
};

type ScenePlaneWorldLayoutInput = {
  readonly camera: SceneWorldCamera;
  readonly anchor: SceneWorldPoint;
  readonly anchorScreen?: {
    readonly x: number;
    readonly y: number;
  };
  readonly viewportWidth?: number;
  readonly viewportHeight: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly translateXpx?: number;
  readonly translateYpx?: number;
  readonly depthOffsetPx?: number;
  readonly scale?: number;
};

const MIN_CAMERA_DISTANCE = 0.0001;
const MIN_NEAR_PLANE_PADDING = 0.01;
const MIN_VIEWPORT_HEIGHT = 1;
const MIN_FOV = 1;
const MAX_FOV = 179;

export function resolveWorldUnitsPerPixel(
  camera: SceneWorldCamera,
  anchor: SceneWorldPoint,
  viewportHeight: number,
): number {
  const dx = camera.position.x - anchor.x;
  const dy = camera.position.y - anchor.y;
  const dz = camera.position.z - anchor.z;
  const distance = Math.max(MIN_CAMERA_DISTANCE, Math.sqrt(dx * dx + dy * dy + dz * dz));
  const safeHeight = Math.max(
    MIN_VIEWPORT_HEIGHT,
    Number.isFinite(viewportHeight) ? viewportHeight : MIN_VIEWPORT_HEIGHT,
  );
  const safeFov = Math.max(
    MIN_FOV,
    Math.min(MAX_FOV, Number.isFinite(camera.fov) ? camera.fov : 48),
  );
  const visibleHeight = 2 * Math.tan((safeFov * Math.PI) / 360) * distance;
  return visibleHeight / safeHeight;
}

export function resolveScenePlaneWorldLayout(
  input: ScenePlaneWorldLayoutInput,
): ScenePlaneWorldLayout {
  const screenAnchoredLayout = resolveScreenAnchoredLayout(input);
  if (screenAnchoredLayout) {
    return screenAnchoredLayout;
  }

  const worldUnitsPerPixel = resolveWorldUnitsPerPixel(
    input.camera,
    input.anchor,
    input.viewportHeight,
  );
  const scale = Number.isFinite(input.scale) ? Math.max(0, input.scale ?? 1) : 1;
  const translateX = Number.isFinite(input.translateXpx) ? input.translateXpx ?? 0 : 0;
  const translateY = Number.isFinite(input.translateYpx) ? input.translateYpx ?? 0 : 0;
  const depthOffset = Number.isFinite(input.depthOffsetPx) ? input.depthOffsetPx ?? 0 : 0;
  const width = Math.max(0, Number.isFinite(input.widthPx) ? input.widthPx : 0);
  const height = Math.max(0, Number.isFinite(input.heightPx) ? input.heightPx : 0);

  return {
    position: {
      x: input.anchor.x + translateX * worldUnitsPerPixel,
      y: input.anchor.y - translateY * worldUnitsPerPixel,
      z: input.anchor.z + depthOffset * worldUnitsPerPixel,
    },
    scale: {
      x: width * scale * worldUnitsPerPixel,
      y: height * scale * worldUnitsPerPixel,
      z: 1,
    },
    worldUnitsPerPixel,
  };
}

function resolveScreenAnchoredLayout(
  input: ScenePlaneWorldLayoutInput,
): ScenePlaneWorldLayout | null {
  const screen = input.anchorScreen;
  const viewportWidth = input.viewportWidth ?? 0;
  const viewportHeight = input.viewportHeight;
  const getWorldDirection = input.camera.getWorldDirection;
  if (
    !screen ||
    !Number.isFinite(screen.x) ||
    !Number.isFinite(screen.y) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    typeof getWorldDirection !== "function"
  ) {
    return null;
  }

  input.camera.updateMatrixWorld?.();
  const camera = input.camera as THREE.PerspectiveCamera;
  const cameraPosition = new THREE.Vector3(
    input.camera.position.x,
    input.camera.position.y,
    input.camera.position.z,
  );
  const forward = getWorldDirection.call(input.camera, new THREE.Vector3()).normalize();
  const cameraToAnchor = new THREE.Vector3(
    input.anchor.x - input.camera.position.x,
    input.anchor.y - input.camera.position.y,
    input.anchor.z - input.camera.position.z,
  );
  const near = Number.isFinite(input.camera.near)
    ? Math.max(0, input.camera.near ?? 0)
    : 0;
  const minViewDepth = Math.max(
    MIN_CAMERA_DISTANCE,
    near + MIN_NEAR_PLANE_PADDING,
  );
  const baseViewDepth = Math.max(
    minViewDepth,
    Math.abs(cameraToAnchor.dot(forward)),
  );
  const safeFov = Math.max(
    MIN_FOV,
    Math.min(MAX_FOV, Number.isFinite(input.camera.fov) ? input.camera.fov : 48),
  );
  const safeHeight = Math.max(MIN_VIEWPORT_HEIGHT, viewportHeight);
  const worldUnitsPerPixel =
    (2 * Math.tan((safeFov * Math.PI) / 360) * baseViewDepth) / safeHeight;
  const translateX = Number.isFinite(input.translateXpx) ? input.translateXpx ?? 0 : 0;
  const translateY = Number.isFinite(input.translateYpx) ? input.translateYpx ?? 0 : 0;
  const depthOffset = Number.isFinite(input.depthOffsetPx) ? input.depthOffsetPx ?? 0 : 0;
  const viewDepth = Math.max(
    minViewDepth,
    baseViewDepth - depthOffset * worldUnitsPerPixel,
  );
  const ndcX = ((screen.x + translateX) / viewportWidth) * 2 - 1;
  const ndcY = 1 - ((screen.y + translateY) / viewportHeight) * 2;
  const rayDirection = new THREE.Vector3(ndcX, ndcY, 0.5)
    .unproject(camera)
    .sub(cameraPosition)
    .normalize();
  const denominator = rayDirection.dot(forward);
  if (!Number.isFinite(denominator) || denominator <= MIN_CAMERA_DISTANCE) {
    return null;
  }

  const position = cameraPosition
    .clone()
    .addScaledVector(rayDirection, viewDepth / denominator);
  const scale = Number.isFinite(input.scale) ? Math.max(0, input.scale ?? 1) : 1;
  const width = Math.max(0, Number.isFinite(input.widthPx) ? input.widthPx : 0);
  const height = Math.max(0, Number.isFinite(input.heightPx) ? input.heightPx : 0);

  return {
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    scale: {
      x: width * scale * worldUnitsPerPixel,
      y: height * scale * worldUnitsPerPixel,
      z: 1,
    },
    worldUnitsPerPixel,
  };
}
