import { describe, expect, it } from "vitest";

import AssetRegistry from "@/lib/webgl/AssetRegistry";
import MotionBus from "@/lib/motion/MotionBus";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import SceneRegistry from "@/lib/webgl/SceneRegistry";
import WebGLPerformanceProbe from "@/lib/webgl/WebGLPerformanceProbe";

describe("WebGLPerformanceProbe", () => {
  it("captures lifecycle metrics for baseline checks", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const sceneRegistry = new SceneRegistry();

    assetRegistry.register({
      id: "hero-portrait",
      src: "/portrait.png",
      kind: "image",
    });
    sceneRegistry.register({
      id: "hero",
      sceneType: "hero",
    });
    sceneRegistry.activate("hero");

    const probe = new WebGLPerformanceProbe({
      scheduler,
      assetRegistry,
      sceneRegistry,
      getCanvasCount: () => 1,
      getRendererProbe: () => ({
        textureCount: 2,
        geometryCount: 1,
        drawCalls: 7,
        dpr: 2,
      }),
      getDirectorTiming: () => ({
        updateCostMs: 1,
        updateCount: 2,
        frameIntervalMs: 16.6,
        renderSubmitCostMs: 1.2,
        frameTimeMs: 16.6,
      }),
      getSceneSnapshots: () => ({
        hero: {
          chapterProgress: 0.4,
          phase: "hold",
        },
      }),
      getGPUResourceSnapshots: () => ({
        hero: {
          total: 3,
          byKind: {
            texture: 1,
            geometry: 1,
            material: 1,
          },
          ownerCounts: {
            "texture:/portrait.png": 1,
          },
        },
      }),
      getCompositionSnapshot: () => ({
        rendererOwner: "global-webgl-stage",
        camera: {
          position: { x: 0, y: 0, z: 0.3 },
          target: { x: 0, y: 0, z: 0 },
          fov: 48,
        },
        hero: {
          portrait: {
            rendered: true,
            visible: true,
            frustumVisible: true,
            position: { x: -0.1, y: 0, z: 0 },
            scale: { x: 0.2, y: 0.3, z: 1 },
            ndc: { x: -0.1, y: 0, z: 0 },
            ndcBounds: { minX: -0.2, maxX: 0, minY: -0.2, maxY: 0.2, minZ: 0, maxZ: 0 },
          },
          foreground: {
            rendered: true,
            visible: true,
            frustumVisible: true,
            position: { x: -0.09, y: 0, z: 0.01 },
            scale: { x: 0.21, y: 0.31, z: 1 },
            ndc: { x: -0.09, y: 0, z: 0.01 },
            ndcBounds: { minX: -0.2, maxX: 0, minY: -0.2, maxY: 0.2, minZ: 0, maxZ: 0.02 },
          },
        },
        media: {
          main: {
            rendered: true,
            visible: true,
            frustumVisible: true,
            position: { x: 0.1, y: 0, z: 0 },
            scale: { x: 0.2, y: 0.12, z: 1 },
            ndc: { x: 0.1, y: 0, z: 0 },
            ndcBounds: { minX: 0, maxX: 0.2, minY: -0.1, maxY: 0.1, minZ: 0, maxZ: 0 },
          },
          secondary: {
            rendered: true,
            visible: true,
            frustumVisible: true,
            position: { x: 0.08, y: 0, z: -0.01 },
            scale: { x: 0.16, y: 0.1, z: 1 },
            ndc: { x: 0.08, y: 0, z: -0.01 },
            ndcBounds: { minX: 0, maxX: 0.16, minY: -0.1, maxY: 0.1, minZ: -0.02, maxZ: 0 },
          },
        },
        books: {
          covers: [
            {
              rendered: true,
              visible: true,
              frustumVisible: true,
              position: { x: 0, y: 0, z: -0.1 },
              scale: { x: 0.2, y: 0.3, z: 1 },
              ndc: { x: 0, y: 0, z: 0 },
              ndcBounds: { minX: -0.1, maxX: 0.1, minY: -0.2, maxY: 0.2, minZ: 0, maxZ: 0 },
            },
            {
              rendered: true,
              visible: true,
              frustumVisible: true,
              position: { x: -0.1, y: 0, z: -0.2 },
              scale: { x: 0.16, y: 0.24, z: 1 },
              ndc: { x: -0.1, y: 0, z: 0 },
              ndcBounds: { minX: -0.2, maxX: 0, minY: -0.2, maxY: 0.2, minZ: 0, maxZ: 0 },
            },
            {
              rendered: true,
              visible: true,
              frustumVisible: true,
              position: { x: 0.1, y: 0, z: -0.2 },
              scale: { x: 0.16, y: 0.24, z: 1 },
              ndc: { x: 0.1, y: 0, z: 0 },
              ndcBounds: { minX: 0, maxX: 0.2, minY: -0.2, maxY: 0.2, minZ: 0, maxZ: 0 },
            },
          ],
          projections: [
            {
              anchorRectCenter: { x: 100, y: 100 },
              expectedScreenCenter: { x: 100, y: 100 },
              projectedScreenCenter: { x: 100, y: 100 },
              deltaPx: { x: 0, y: 0 },
              viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
            },
            {
              anchorRectCenter: { x: 100, y: 100 },
              expectedScreenCenter: { x: 50, y: 100 },
              projectedScreenCenter: { x: 50, y: 100 },
              deltaPx: { x: 0, y: 0 },
              viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
            },
            {
              anchorRectCenter: { x: 100, y: 100 },
              expectedScreenCenter: { x: 150, y: 100 },
              projectedScreenCenter: { x: 150, y: 100 },
              deltaPx: { x: 0, y: 0 },
              viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
            },
          ],
          roleOrder: ["primary", "secondary-left", "secondary-right"],
          textureSources: ["/primary.webp", "/left.webp", "/right.webp"],
          meshCount: 3,
          geometryCount: 1,
          materialCount: 3,
          textureCount: 3,
          expectedDrawCalls: 3,
          allTexturesReady: true,
          allCoversRendered: true,
          materialSides: [0, 0, 0],
          depthWrites: [false, false, false],
          motion: {
            primary: {
              visualRole: "primary",
              translateX: 0,
              translateY: 0,
              scale: 1,
              opacity: 1,
              depthOffsetPx: 0,
            },
            "secondary-left": {
              visualRole: "secondary-left",
              translateX: -50,
              translateY: 0,
              scale: 0.8,
              opacity: 0.9,
              depthOffsetPx: -10,
            },
            "secondary-right": {
              visualRole: "secondary-right",
              translateX: 50,
              translateY: 0,
              scale: 0.8,
              opacity: 0.9,
              depthOffsetPx: -10,
            },
          },
          supportingVisibility: {
            leftExposedFraction: 0.4,
            rightExposedFraction: 0.4,
          },
        },
      }),
    });

    scheduler.start();
    scheduler.setLowUpdateMode(true, 3);

    const snapshot = probe.snapshot();
    expect(snapshot.canvasCount).toBe(1);
    expect(snapshot.render.isRunning).toBe(true);
    expect(snapshot.render.isLowUpdateMode).toBe(true);
    expect(snapshot.drawCalls).toBe(7);
    expect(snapshot.render.drawCalls).toBe(7);
    expect(snapshot.diagnostics.sceneStates.hero?.dominant).toBe(true);
    expect(snapshot.diagnostics.sceneSnapshots.hero).toEqual({
      chapterProgress: 0.4,
      phase: "hold",
    });
    expect(snapshot.diagnostics.assetOwnerCounts["hero-portrait"]).toBe(0);
    expect(snapshot.diagnostics.gpuResources.hero?.byKind.texture).toBe(1);
    expect(snapshot.composition?.camera.target).toEqual({ x: 0, y: 0, z: 0 });
    expect(snapshot.composition?.hero.portrait.rendered).toBe(true);
    expect(snapshot.composition?.hero.foreground?.rendered).toBe(true);
    expect(snapshot.composition?.media.main.rendered).toBe(true);
    expect(snapshot.composition?.media.secondary.rendered).toBe(true);
    expect(snapshot.composition?.books?.meshCount).toBe(3);
    expect(snapshot.composition?.books?.textureCount).toBe(3);
    expect(snapshot.render.geometryCount).toBe(1);
    expect(snapshot.render.textureCount).toBe(2);
    expect(snapshot.render.frameIntervalMs).toBe(16.6);
    expect(snapshot.render.updateCount).toBe(2);
    expect(snapshot.render.updateCostMs).toBe(1);
    expect(snapshot.drawCalls).toBe(7);
    expect(snapshot.textures.ready).toBe(0);
    expect(snapshot.textures.activeInRenderer).toBe(2);
    expect(snapshot.render.dpr).toBe(2);
    expect(snapshot.render.renderSubmitCostMs).toBe(1.2);
    expect(snapshot.render.frameTimeMs).toBe(16.6);
    expect(snapshot.geometries).toBe(1);
    expect(snapshot.render.drawCalls).toBe(7);

    scheduler.stop();
    scheduler.dispose();
    frame.stop();
  });
});
