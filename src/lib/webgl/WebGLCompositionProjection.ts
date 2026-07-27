import * as THREE from "three";

import type {
  WebGLCompositionVector,
  WebGLLayerCompositionSnapshot,
} from "@/lib/webgl/WebGLCompositionSnapshot";

const CLIP_MIN = -1;
const CLIP_MAX = 1;

function toVectorSnapshot(vector: THREE.Vector3): WebGLCompositionVector {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

export function snapshotWebGLLayerComposition(
  mesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  rendered: boolean,
  viewport?: {
    readonly width: number;
    readonly height: number;
  },
): WebGLLayerCompositionSnapshot {
  camera.updateMatrixWorld();
  mesh.updateWorldMatrix(true, false);

  const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
  const ndc = worldPosition.clone().project(camera);
  const worldBounds = new THREE.Box3().setFromObject(mesh);
  const min = worldBounds.min;
  const max = worldBounds.max;
  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ].map((corner) => corner.project(camera));

  const ndcBounds = {
    minX: Math.min(...corners.map((corner) => corner.x)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
    minZ: Math.min(...corners.map((corner) => corner.z)),
    maxZ: Math.max(...corners.map((corner) => corner.z)),
  };
  const frustumVisible =
    ndcBounds.maxX >= CLIP_MIN &&
    ndcBounds.minX <= CLIP_MAX &&
    ndcBounds.maxY >= CLIP_MIN &&
    ndcBounds.minY <= CLIP_MAX &&
    ndcBounds.maxZ >= CLIP_MIN &&
    ndcBounds.minZ <= CLIP_MAX;
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const opacity =
    material && "opacity" in material && typeof material.opacity === "number"
      ? material.opacity
      : undefined;
  const screen =
    viewport && viewport.width > 0 && viewport.height > 0
      ? {
        center: {
          x: ((ndc.x + 1) * 0.5) * viewport.width,
          y: ((1 - ndc.y) * 0.5) * viewport.height,
        },
        bounds: {
          left: ((ndcBounds.minX + 1) * 0.5) * viewport.width,
          right: ((ndcBounds.maxX + 1) * 0.5) * viewport.width,
          top: ((1 - ndcBounds.maxY) * 0.5) * viewport.height,
          bottom: ((1 - ndcBounds.minY) * 0.5) * viewport.height,
        },
      }
      : undefined;

  return {
    rendered: rendered && mesh.visible,
    visible: mesh.visible,
    frustumVisible,
    opacity,
    position: toVectorSnapshot(worldPosition),
    scale: toVectorSnapshot(mesh.scale),
    ndc: toVectorSnapshot(ndc),
    ndcBounds,
    screen,
  };
}
