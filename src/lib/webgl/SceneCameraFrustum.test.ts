import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { constrainWorldPointToCameraFrustum } from "@/lib/webgl/SceneCameraFrustum";

describe("constrainWorldPointToCameraFrustum", () => {
  const createCamera = (): THREE.PerspectiveCamera => {
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
  };

  it("keeps an in-frustum world point unchanged", () => {
    const camera = createCamera();
    const point = { x: 0.5, y: 0.25, z: 0 };

    const result = constrainWorldPointToCameraFrustum(point, camera);

    expect(result.x).toBeCloseTo(point.x);
    expect(result.y).toBeCloseTo(point.y);
    expect(result.z).toBeCloseTo(point.z);
  });

  it("projects an offscreen point onto the current camera edge without changing depth", () => {
    const camera = createCamera();
    const point = { x: 0, y: -20, z: 0 };
    const originalNdc = new THREE.Vector3(point.x, point.y, point.z).project(camera);

    const result = constrainWorldPointToCameraFrustum(point, camera);
    const constrainedNdc = new THREE.Vector3(result.x, result.y, result.z).project(camera);

    expect(originalNdc.y).toBeLessThan(-1);
    expect(constrainedNdc.y).toBeCloseTo(-1, 4);
    expect(constrainedNdc.z).toBeCloseTo(originalNdc.z, 6);
  });
});
