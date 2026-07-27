export type WebGLContextCandidate =
  | WebGLRenderingContext
  | WebGL2RenderingContext
  | null;

export type WebGLCapabilityResult = {
  readonly supported: boolean;
  readonly isWebGL2: boolean;
  readonly reason: string | null;
};

export type WebGLRuntimeContext = {
  readonly context: WebGLContextCandidate;
  readonly canvas: HTMLCanvasElement;
};

export default class WebGLCapability {
  static probe(): WebGLCapabilityResult {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return {
        supported: false,
        isWebGL2: false,
        reason: "Server environment does not support runtime canvas APIs.",
      };
    }

    try {
      const probeCanvas = document.createElement("canvas");
      const context = probeCanvas.getContext("webgl2") ?? probeCanvas.getContext("webgl");

      const isWebGL2 =
        typeof WebGL2RenderingContext !== "undefined" &&
        context instanceof WebGL2RenderingContext;

      return {
        supported: context !== null,
        isWebGL2,
        reason: context === null ? "Browser does not expose WebGL context." : null,
      };
    } catch {
      return {
        supported: false,
        isWebGL2: false,
        reason: "WebGL context initialization threw an exception.",
      };
    }
  }

  static getContextFromCanvas(canvas: HTMLCanvasElement): WebGLRuntimeContext | null {
    if (!canvas) {
      return null;
    }

    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");

    if (!context) {
      return null;
    }

    return {
      context: context as WebGLRenderingContext,
      canvas,
    };
  }

  static normalizeResizeContext(context: WebGLRenderingContext): void {
    const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    context.viewport(0, 0, width * pixelRatio, height * pixelRatio);
  }
}
