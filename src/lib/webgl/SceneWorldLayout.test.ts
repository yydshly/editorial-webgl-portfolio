import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { domToWorld } from "@/lib/webgl/domToWorld";
import { resolveScenePlaneWorldLayout } from "@/lib/webgl/SceneWorldLayout";

type ViewportCase = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
};

const cases: readonly ViewportCase[] = [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    anchorX: 600,
    anchorY: 340,
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    anchorX: 195,
    anchorY: 300,
  },
];

describe("SceneWorldLayout screen-space anchoring", () => {
  it.each(cases)(
    "round-trips a $name DOM anchor through the final camera within one CSS pixel",
    ({ width, height, anchorX, anchorY }) => {
      const baseline = domToWorld({
        x: anchorX,
        y: anchorY,
        viewport: { width, height },
        camera: { fov: 48, distance: 8 },
        depth: 8,
      }).world;
      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
      camera.position.set(baseline.x - 0.05, baseline.y, baseline.z + 0.75);
      camera.lookAt(baseline.x, baseline.y, baseline.z);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      const input = {
        camera,
        anchor: baseline,
        anchorScreen: {
          x: anchorX,
          y: anchorY,
        },
        viewportWidth: width,
        viewportHeight: height,
        widthPx: 420,
        heightPx: 260,
      } as Parameters<typeof resolveScenePlaneWorldLayout>[0] & {
        readonly anchorScreen: {
          readonly x: number;
          readonly y: number;
        };
        readonly viewportWidth: number;
      };
      const layout = resolveScenePlaneWorldLayout(input);
      const projected = new THREE.Vector3(
        layout.position.x,
        layout.position.y,
        layout.position.z,
      ).project(camera);
      const projectedScreen = {
        x: ((projected.x + 1) * 0.5) * width,
        y: ((1 - projected.y) * 0.5) * height,
      };

      expect(projectedScreen.x).toBeCloseTo(anchorX, 0);
      expect(projectedScreen.y).toBeCloseTo(anchorY, 0);
      expect(Math.abs(projectedScreen.x - anchorX)).toBeLessThanOrEqual(1);
      expect(Math.abs(projectedScreen.y - anchorY)).toBeLessThanOrEqual(1);
    },
  );

  it("keeps a screen-anchored plane beyond the active camera near plane when anchors coincide", () => {
    const camera = new THREE.PerspectiveCamera(48, 390 / 844, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const layout = resolveScenePlaneWorldLayout({
      camera,
      anchor: { x: 0, y: 0, z: 0 },
      anchorScreen: { x: 195, y: 422 },
      viewportWidth: 390,
      viewportHeight: 844,
      widthPx: 320,
      heightPx: 200,
    });
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const viewDepth = new THREE.Vector3(
      layout.position.x - camera.position.x,
      layout.position.y - camera.position.y,
      layout.position.z - camera.position.z,
    ).dot(forward);

    expect(viewDepth).toBeGreaterThan(camera.near);
  });
});
