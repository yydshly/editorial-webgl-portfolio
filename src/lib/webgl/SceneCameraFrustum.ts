import * as THREE from "three";

import type { SceneWorldPoint } from "@/lib/webgl/SceneWorldLayout";

const CLIP_MIN = -1;
const CLIP_MAX = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function constrainWorldPointToCameraFrustum(
  point: SceneWorldPoint,
  camera: THREE.PerspectiveCamera,
): SceneWorldPoint {
  camera.updateMatrixWorld();
  const projected = new THREE.Vector3(point.x, point.y, point.z).project(camera);
  if (
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y) ||
    !Number.isFinite(projected.z) ||
    projected.z < CLIP_MIN ||
    projected.z > CLIP_MAX
  ) {
    return point;
  }

  const constrainedX = clamp(projected.x, CLIP_MIN, CLIP_MAX);
  const constrainedY = clamp(projected.y, CLIP_MIN, CLIP_MAX);
  if (constrainedX === projected.x && constrainedY === projected.y) {
    return point;
  }

  projected.x = constrainedX;
  projected.y = constrainedY;
  const world = projected.unproject(camera);
  return {
    x: world.x,
    y: world.y,
    z: world.z,
  };
}
