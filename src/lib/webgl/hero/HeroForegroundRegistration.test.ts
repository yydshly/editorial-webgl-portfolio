import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { heroSceneConfig } from "@/lib/webgl/hero/heroSceneConfig";
import { resolveHeroForegroundRegistrationLayout } from "@/lib/webgl/hero/HeroForegroundRegistration";
import { resolveScenePlaneWorldLayout } from "@/lib/webgl/SceneWorldLayout";

type ScreenRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
};

const cases = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    texture: { width: 1024, height: 1536 },
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    texture: { width: 760, height: 1536 },
  },
] as const;

describe("Hero foreground screen registration", () => {
  it.each(cases)(
    "projects the $name foreground over the matching portrait crop",
    ({ viewport, texture }) => {
      const camera = new THREE.PerspectiveCamera(
        48,
        viewport.width / viewport.height,
        0.1,
        1000,
      );
      const anchor = new THREE.Vector3(0, 0, -8);
      camera.position.set(-0.18, 0.1, -7.65);
      camera.lookAt(anchor);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      const anchorScreen = {
        x: viewport.width * 0.64,
        y: viewport.height * 0.44,
      };
      const portraitWidth = viewport.width <= 768
        ? Math.max(160, Math.min(Math.min(320, viewport.width * 0.65), viewport.width * 0.58))
        : Math.max(190, Math.min(Math.min(420, viewport.width * 0.34), viewport.width * 0.34));
      const portraitHeight = portraitWidth / (texture.width / texture.height);
      const crop = heroSceneConfig.foreground.selectUvRect(viewport.width);
      const portraitLayout = resolveScenePlaneWorldLayout({
        camera,
        anchor,
        anchorScreen,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        widthPx: portraitWidth,
        heightPx: portraitHeight,
        scale: 1,
      });

      const portrait = createPlane(portraitLayout);
      const foregroundLayout = resolveHeroForegroundRegistrationLayout({
        portraitMesh: portrait,
        camera,
        crop,
        viewport,
        depthOffsetPx: 35,
        relativeTranslateXpx: 0,
        relativeTranslateYpx: 0,
        relativeScale: heroSceneConfig.foreground.scaleMultiplier,
      });
      const foreground = createPlane(foregroundLayout);
      const expected = projectLocalRect(
        portrait,
        camera,
        viewport,
        {
          minX: crop.uMin - 0.5,
          maxX: crop.uMax - 0.5,
          minY: 0.5 - crop.vMax,
          maxY: 0.5 - crop.vMin,
        },
      );
      const actual = projectLocalRect(
        foreground,
        camera,
        viewport,
        {
          minX: -0.5,
          maxX: 0.5,
          minY: -0.5,
          maxY: 0.5,
        },
      );
      const residual = {
        centerX: actual.centerX - expected.centerX,
        centerY: actual.centerY - expected.centerY,
        widthPercent: ((actual.width - expected.width) / expected.width) * 100,
        heightPercent: ((actual.height - expected.height) / expected.height) * 100,
      };
      const evidence = JSON.stringify({ expected, actual, residual });

      expect(Math.abs(residual.centerX), evidence).toBeLessThanOrEqual(4);
      expect(Math.abs(residual.centerY), evidence).toBeLessThanOrEqual(4);
      expect(Math.abs(residual.widthPercent), evidence).toBeLessThanOrEqual(5);
      expect(Math.abs(residual.heightPercent), evidence).toBeLessThanOrEqual(5);
    },
  );
});

function createPlane(
  layout: Pick<ReturnType<typeof resolveScenePlaneWorldLayout>, "position" | "scale">,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  mesh.position.set(layout.position.x, layout.position.y, layout.position.z);
  mesh.scale.set(layout.scale.x, layout.scale.y, layout.scale.z);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function projectLocalRect(
  mesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  viewport: { readonly width: number; readonly height: number },
  rect: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  },
): ScreenRect {
  const points = [
    new THREE.Vector3(rect.minX, rect.minY, 0),
    new THREE.Vector3(rect.maxX, rect.minY, 0),
    new THREE.Vector3(rect.minX, rect.maxY, 0),
    new THREE.Vector3(rect.maxX, rect.maxY, 0),
  ].map((point) => {
    const projected = mesh.localToWorld(point).project(camera);
    return {
      x: ((projected.x + 1) * 0.5) * viewport.width,
      y: ((1 - projected.y) * 0.5) * viewport.height,
    };
  });
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));

  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) * 0.5,
    centerY: (top + bottom) * 0.5,
    width: right - left,
    height: bottom - top,
  };
}
