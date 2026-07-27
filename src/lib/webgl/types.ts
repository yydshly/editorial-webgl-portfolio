import type { MotionFramePayload } from "@/lib/motion/types";

export type WebGLFramePayload = MotionFramePayload;

export type WebGLTick = (payload: WebGLFramePayload) => void;

export type WebGLCapabilityBridge = {
  readonly tick: WebGLTick;
  readonly dispose?: () => void;
};
