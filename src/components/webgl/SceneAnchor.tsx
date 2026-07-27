"use client";

import { useContext, useEffect } from "react";

import WebGLRuntimeContext from "@/lib/webgl/WebGLRuntimeContext";

type SceneAnchorProps = {
  readonly anchorId: string;
  readonly sceneType?: string;
};

export default function SceneAnchor({
  anchorId,
  sceneType,
}: SceneAnchorProps): null {
  const runtime = useContext(WebGLRuntimeContext);

  useEffect(() => {
    if (!runtime) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const element = document.getElementById(anchorId);
    if (!element) {
      return;
    }

    return runtime.domTracker.register({
      id: anchorId,
      element,
      sceneType,
    });
  }, [anchorId, sceneType, runtime]);

  return null;
}
