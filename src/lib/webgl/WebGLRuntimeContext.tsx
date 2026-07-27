"use client";

import { createContext, useContext } from "react";

import type CameraRig from "@/lib/webgl/CameraRig";
import type DOMTracker from "@/lib/webgl/DOMTracker";

export type WebGLRuntimeContextValue = {
  readonly domTracker: DOMTracker;
  readonly cameraRig: CameraRig;
};

const WebGLRuntimeContext = createContext<WebGLRuntimeContextValue | null>(null);

export function useWebGLRuntime(): WebGLRuntimeContextValue {
  const runtime = useContext(WebGLRuntimeContext);
  if (!runtime) {
    throw new Error("useWebGLRuntime must be used within a WebGLRuntimeContext.");
  }
  return runtime;
}

export default WebGLRuntimeContext;
