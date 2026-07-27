import { describe, expect, it } from "vitest";

import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import CameraRig from "@/lib/webgl/CameraRig";
import { domToWorld } from "@/lib/webgl/domToWorld";

describe("CameraRig", () => {
  it("exposes the owned camera position and applied target for composition validation", () => {
    const camera = new CameraRig();
    const intent: CameraIntent = {
      target: { x: 1, y: -2, z: -8 },
      positionOffset: { x: 0.1, y: 0.2, z: 0.4 },
      fovIntent: 46,
      depthBias: 0,
      weight: 1,
    };

    camera.setCameraIntent(intent);
    camera.update(1 / 60);

    expect(camera.compositionSnapshot).toEqual({
      position: { x: 1.1, y: -1.8, z: -7.6 },
      target: { x: 1, y: -2, z: -8 },
      fov: 46,
    });
  });

  it("computes breakpoints and aspect from viewport updates", () => {
    const camera = new CameraRig();
    camera.setViewport(375, 812, 2);

    expect(camera.currentBreakpoint).toBe("mobile");
    expect(camera.viewport.width).toBe(375);
    expect(camera.viewport.height).toBe(812);
    expect(camera.viewport.devicePixelRatio).toBe(2);
    expect(camera.state.aspect).toBeCloseTo(375 / 812);
  });

  it("maps screen coordinates to perspective world coordinates", () => {
    const camera = new CameraRig({
      perspective: { fov: 60, distance: 10 },
    });
    camera.setViewport(1600, 900, 1);

    const origin = camera.toWorld(800, 450);
    expect(origin.x).toBeCloseTo(0);
    expect(origin.y).toBeCloseTo(0);
    expect(origin.z).toBe(-10);

    const topLeft = camera.toWorld(0, 0, 10);
    expect(topLeft.x).toBeLessThan(0);
    expect(topLeft.y).toBeGreaterThan(0);
  });

  it("matches domToWorld helper output shape", () => {
    const camera = new CameraRig({
      perspective: { fov: 45, distance: 8 },
    });
    camera.setViewport(1024, 768, 1);

    const mapped = domToWorld({
      x: 256,
      y: 192,
      viewport: {
        width: camera.viewport.width,
        height: camera.viewport.height,
      },
      camera: camera.getPerspective(),
      depth: camera.state.distance,
    });

    expect(mapped.normalized.x).toBeCloseTo((256 / 1024) * 2 - 1);
    expect(mapped.normalized.y).toBeCloseTo(1 - (192 / 768) * 2);
    expect(mapped.world.z).toBe(-8);
  });

  it("stores and exposes camera intent without ownership side effects", () => {
    const camera = new CameraRig();
    const intent: CameraIntent = {
      target: { x: 0, y: 0, z: 0 },
      positionOffset: { x: 0.1, y: 0, z: 0.3 },
      fovIntent: 46,
      depthBias: -0.2,
      weight: 1,
    };

    camera.setCameraIntent(intent);
    expect(camera.cameraIntent).toEqual(intent);

    camera.setCameraIntent(null);
    expect(camera.cameraIntent).toBeNull();
  });

  it("applies camera intent to camera parameters on update", () => {
    const camera = new CameraRig();
    camera.setViewport(1280, 720, 1);

    const intent = {
      target: { x: 2, y: -1, z: 0 },
      positionOffset: { x: 1, y: 0.5, z: 5 },
      fovIntent: 52,
      depthBias: -0.3,
      weight: 1,
    };

    camera.setCameraIntent(intent);
    camera.update(1 / 60);

    expect(camera.camera.position.x).toBeCloseTo(intent.target.x + intent.positionOffset.x);
    expect(camera.camera.position.y).toBeCloseTo(intent.target.y + intent.positionOffset.y);
    expect(camera.camera.position.z).toBeCloseTo(intent.target.z + intent.positionOffset.z);
    expect(camera.camera.fov).toBe(intent.fovIntent);
  });

  it("supports smooth interpolation across intent changes by delta time", () => {
    const camera = new CameraRig({
      perspective: {
        fov: 48,
        distance: 6,
      },
      transitionSpeed: 10,
    });
    camera.setViewport(1280, 720, 1);

    const firstIntent = {
      target: { x: 0, y: 0, z: 0 },
      positionOffset: { x: 0, y: 0, z: 6 },
      fovIntent: 48,
      depthBias: 0,
      weight: 1,
    };
    camera.setCameraIntent(firstIntent);
    camera.update(1 / 60);

    const secondIntent = {
      target: { x: 1, y: 1, z: 0 },
      positionOffset: { x: 0, y: 0, z: 6 },
      fovIntent: 54,
      depthBias: 0,
      weight: 1,
    };
    camera.setCameraIntent(secondIntent);

    const deltaSeconds = 0.25;
    const transitionSpeed = 10;
    const transitionFactor = 1 - Math.exp(-transitionSpeed * deltaSeconds * secondIntent.weight);

    camera.update(deltaSeconds);

    expect(camera.camera.position.x).toBeCloseTo(0 + (1 - 0) * transitionFactor, 5);
    expect(camera.camera.position.y).toBeCloseTo(0 + (1 - 0) * transitionFactor, 5);
    expect(camera.camera.fov).toBeLessThan(secondIntent.fovIntent);
    expect(camera.camera.fov).toBeGreaterThan(firstIntent.fovIntent);
    expect(camera.camera.fov).not.toBe(secondIntent.fovIntent);
  });

  it("can snap immediately to the next coherent intent when interpolation must be skipped", () => {
    const camera = new CameraRig({
      perspective: {
        fov: 48,
        distance: 6,
      },
      transitionSpeed: 10,
    });
    camera.setViewport(1280, 720, 1);

    const firstIntent = {
      target: { x: 0, y: 0, z: 0 },
      positionOffset: { x: 0, y: 0, z: 6 },
      fovIntent: 48,
      depthBias: 0,
      weight: 1,
    };
    camera.setCameraIntent(firstIntent);
    camera.update(1 / 60);

    const secondIntent = {
      target: { x: 2, y: -1, z: 0 },
      positionOffset: { x: 1, y: 0.5, z: 5 },
      fovIntent: 54,
      depthBias: 0,
      weight: 1,
    };
    camera.setCameraIntent(secondIntent, { immediate: true });
    camera.update(1 / 60);

    expect(camera.camera.position.x).toBeCloseTo(3);
    expect(camera.camera.position.y).toBeCloseTo(-0.5);
    expect(camera.camera.position.z).toBeCloseTo(5);
    expect(camera.compositionSnapshot.target).toEqual(secondIntent.target);
    expect(camera.camera.fov).toBe(secondIntent.fovIntent);
  });

  it("applies an About hold intent immediately through its single owned camera", () => {
    const camera = new CameraRig();
    const ownedCamera = camera.camera;
    const aboutOriginIntent: CameraIntent = {
      target: { x: -0.8, y: 0, z: 0 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };

    camera.setCameraIntent(aboutOriginIntent, { immediate: true });
    camera.update(1 / 60);

    expect(camera.camera).toBe(ownedCamera);
    expect(camera.compositionSnapshot).toEqual({
      position: { x: -0.8, y: 0, z: 0.35 },
      target: aboutOriginIntent.target,
      fov: 48,
    });
  });

  it("keeps camera state when intent becomes null", () => {
    const camera = new CameraRig({
      perspective: {
        fov: 50,
        distance: 8,
      },
    });
    camera.setViewport(1200, 800, 1);

    const intent: CameraIntent = {
      target: { x: 0.4, y: -0.2, z: 1 },
      positionOffset: { x: 0.1, y: 0.05, z: 0.3 },
      fovIntent: 46,
      depthBias: -0.1,
      weight: 1,
    };

    camera.setCameraIntent(intent);
    camera.update(1 / 60);
    const position = { ...camera.camera.position };
    const initialFov = camera.camera.fov;

    camera.setCameraIntent(null);
    camera.update(1 / 60);

    expect(camera.camera.position).toMatchObject(position);
    expect(camera.camera.fov).toBe(initialFov);
  });
});
