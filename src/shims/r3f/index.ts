import React from "react";

export type ReactNodeLike = React.ReactNode;

export type CanvasProps = {
  readonly children?: ReactNodeLike;
  readonly dpr?: number;
  readonly gl?: Record<string, unknown>;
  readonly camera?: Record<string, unknown>;
  readonly frameloop?: "always" | "demand" | "never";
};

export const Canvas = ({ children }: CanvasProps): ReactNodeLike => {
  return children;
};

export type RenderCallback = (state: {
  readonly clock: {
    readonly getElapsedTime: () => number;
  };
  readonly camera: unknown;
  readonly scene: unknown;
}) => void;

export function useFrame(_callback: RenderCallback): void {
  void _callback;
  return;
}

export function useThree(): never {
  throw new Error("R3F runtime is not available in this environment.");
}

export const useLoader = (): never => {
  throw new Error("R3F runtime is not available in this environment.");
};

export const createPortal = (children: ReactNodeLike, target: HTMLElement): ReactNodeLike => {
  void target;
  return children;
};
