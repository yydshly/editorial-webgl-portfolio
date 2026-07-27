import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { snapshotWebGLLayerComposition } from "@/lib/webgl/WebGLCompositionProjection";

describe("snapshotWebGLLayerComposition", () => {
  const createCamera = (): THREE.PerspectiveCamera => {
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
  };

  it("reports a plane intersecting the camera frustum even when its center is outside clip space", () => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(0, -4.2, 0);
    mesh.scale.set(2, 2, 1);

    const snapshot = snapshotWebGLLayerComposition(mesh, createCamera(), true);

    expect(snapshot.ndc.y).toBeLessThan(-1);
    expect(snapshot.ndcBounds.maxY).toBeGreaterThan(-1);
    expect(snapshot.frustumVisible).toBe(true);
  });

  it("reports a plane fully outside the camera frustum", () => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(0, -20, 0);

    const snapshot = snapshotWebGLLayerComposition(mesh, createCamera(), true);

    expect(snapshot.frustumVisible).toBe(false);
    expect(snapshot.ndcBounds.maxY).toBeLessThan(-1);
  });
});
