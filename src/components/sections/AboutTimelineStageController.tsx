"use client";

import { useContext, useEffect, useRef } from "react";

import { useRuntimeOptional } from "@/lib/motion/RuntimeProvider";
import WebGLRuntimeContext from "@/lib/webgl/WebGLRuntimeContext";
import {
  resolveAboutChapterProgress,
  resolveAboutTimelineStagePresentation,
} from "@/lib/webgl/about/AboutChapterProgress";

type AboutTimelineStageControllerProps = {
  readonly sectionId: string;
  readonly portraitAnchorId: string;
};

type AboutGeometry = {
  readonly relativeScroll: number;
  readonly viewportHeight: number;
  readonly anchorHeight: number;
};

export default function AboutTimelineStageController({
  sectionId,
  portraitAnchorId,
}: AboutTimelineStageControllerProps): null {
  const runtime = useRuntimeOptional();
  const webglRuntime = useContext(WebGLRuntimeContext);
  const geometry = useRef<AboutGeometry | null>(null);

  useEffect(() => {
    if (!runtime || typeof document === "undefined") {
      return;
    }

    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    const stages = Array.from(
      section.querySelectorAll<HTMLElement>("[data-about-stage-index]"),
    );
    if (stages.length === 0) {
      return;
    }

    const unregisterMeasure = runtime.frame.register("MEASURE", () => {
      // The desktop portrait is CSS-sticky, so its true viewport rect is
      // dynamic even without a resize. Refresh only this About anchor inside
      // MEASURE; Scene updates continue to consume DOMTracker snapshots.
      webglRuntime?.domTracker.refreshAnchor(portraitAnchorId);
      const snapshot = runtime.snapshot.getSnapshot();
      if (snapshot.reducedMotion) {
        geometry.current = null;
        return;
      }

      const bounds = section.getBoundingClientRect();
      geometry.current = {
        // Keep the DOM timeline on the same viewport-entry contract used by
        // AboutScene: zero begins when the section top enters the viewport
        // bottom, and one completes after the section exits the viewport top.
        relativeScroll: Math.max(0, snapshot.viewport.height - bounds.top),
        viewportHeight: snapshot.viewport.height,
        anchorHeight: bounds.height,
      };
    });
    const unregisterAnimate = runtime.frame.register("ANIMATE", () => {
      const snapshot = runtime.snapshot.getSnapshot();
      const chapter = resolveAboutChapterProgress({
        reducedMotion: snapshot.reducedMotion,
        ...geometry.current,
      });
      const stageStates = resolveAboutTimelineStagePresentation(
        chapter.activeStageIndex,
      );

      stages.forEach((stage, index) => {
        const state = stageStates[index];
        if (stage.dataset.aboutStageState !== state) {
          stage.dataset.aboutStageState = state;
        }
      });
    });

    return () => {
      unregisterMeasure();
      unregisterAnimate();
    };
  }, [portraitAnchorId, runtime, sectionId, webglRuntime]);

  return null;
}
