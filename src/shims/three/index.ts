import type { ReactNode } from "react";

export type Vector2Like = {
  x: number;
  y: number;
};

export type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export type EulerLike = {
  x: number;
  y: number;
  z: number;
  order?: string;
};

export type TextureSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export class Vector2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(value: Vector2Like): this {
    this.x = value.x;
    this.y = value.y;
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }
}

export class Vector3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(value: Vector3Like): this {
    this.x = value.x;
    this.y = value.y;
    this.z = value.z;
    return this;
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
}

export class Euler {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
    public order: string = "XYZ",
  ) {}
}

export const MathUtils = {
  degToRad(angle: number): number {
    return angle * (Math.PI / 180);
  },
};

export class Texture {
  public needsUpdate = true;
  constructor(
    public image?: TextureSource | null,
  ) {}
}

export type MeshBasicMaterialParameters = {
  readonly map?: Texture | null;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly side?: string;
};

export class MeshBasicMaterial {
  public map?: Texture | null;
  public transparent: boolean;
  public opacity: number;
  public side?: string;

  constructor({
    map = null,
    transparent = false,
    opacity = 1,
    side,
  }: MeshBasicMaterialParameters = {}) {
    this.map = map;
    this.transparent = transparent;
    this.opacity = opacity;
    this.side = side;
  }

  dispose(): void {
    this.map = null;
  }
}

export class PlaneGeometry {
  constructor(
    public width = 1,
    public height = 1,
  ) {}

  dispose(): void {
    this.width = 1;
    this.height = 1;
  }
}

export class Object3D {
  public readonly children: Object3D[] = [];
  public readonly position = new Vector3();
  public readonly rotation = new Euler();
  public readonly scale = new Vector3(1, 1, 1);
  public readonly userData: Record<string, unknown> = {};

  add(child: Object3D): this {
    this.children.push(child);
    return this;
  }

  remove(child: Object3D): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
  }
}

export class Scene extends Object3D {
  constructor() {
    super();
    this.background = null;
  }

  public background: null | number | string;
}

export class Camera extends Object3D {}

export class PerspectiveCamera extends Camera {
  constructor(
    public fov = 50,
    public aspect = 1,
    public near = 0.1,
    public far = 1000,
  ) {
    super();
    this.position.z = 1;
  }

  updateProjectionMatrix(): void {
    // No-op in shim.
  }
}

export class OrthographicCamera extends Camera {
  constructor(
    public left = -1,
    public right = 1,
    public top = 1,
    public bottom = -1,
    public near = 0.1,
    public far = 1000,
  ) {
    super();
  }

  updateProjectionMatrix(): void {
    // No-op in shim.
  }
}

export class Mesh extends Object3D {
  constructor(
    public readonly geometry: PlaneGeometry,
    public readonly material: MeshBasicMaterial,
  ) {
    super();
  }
}

export type WebGLRendererParameters = {
  canvas: HTMLCanvasElement;
  context: WebGLRenderingContext;
  alpha?: boolean;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
};

export class WebGLRenderer {
  public readonly domElement: HTMLCanvasElement;
  public readonly context: WebGLRenderingContext;
  public readonly autoClear = true;
  private clearColorR = 0;
  private clearColorG = 0;
  private clearColorB = 0;
  private clearColorA = 0;
  private pixelRatio = 1;

  constructor({
    canvas,
    context,
  }: WebGLRendererParameters) {
    this.domElement = canvas;
    this.context = context;
    this.setPixelRatio(1);
  }

  setPixelRatio(value: number): void {
    this.pixelRatio = Number.isFinite(value) ? Math.max(1, value) : 1;
  }

  setSize(width: number, height: number, updateStyle = true): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return;
    }

    const pxWidth = Math.max(1, Math.round(width * this.pixelRatio));
    const pxHeight = Math.max(1, Math.round(height * this.pixelRatio));
    this.context.canvas.width = pxWidth;
    this.context.canvas.height = pxHeight;

    if (updateStyle) {
      const canvas = this.context.canvas as HTMLCanvasElement;
      canvas.style.width = `${Math.max(1, Math.round(width))}px`;
      canvas.style.height = `${Math.max(1, Math.round(height))}px`;
    }
  }

  setClearColor(r: number | string, g: number, b: number, a = 1): void {
    if (typeof r === "number") {
      this.clearColorR = r;
      this.clearColorG = g;
      this.clearColorB = b;
      this.clearColorA = a;
      return;
    }

    const match = r.match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (!match) {
      return;
    }

    const base = match[1];
    this.clearColorR = parseInt(base.slice(0, 2), 16) / 255;
    this.clearColorG = parseInt(base.slice(2, 4), 16) / 255;
    this.clearColorB = parseInt(base.slice(4, 6), 16) / 255;
    if (match[2]) {
      this.clearColorA = parseInt(match[2], 16) / 255;
    } else {
      this.clearColorA = a;
    }
  }

  setClearAlpha(alpha: number): void {
    this.clearColorA = Number.isFinite(alpha) ? alpha : this.clearColorA;
  }

  clear(): void {
    this.context.clearColor(
      this.clearColorR,
      this.clearColorG,
      this.clearColorB,
      this.clearColorA,
    );
    this.context.clear(this.context.COLOR_BUFFER_BIT);
  }

  render(scene: Scene): void {
    for (const child of scene.children) {
      const candidate = child as Object3D & {
        userData?: {
          draw?: () => void;
        };
      };
      const draw = candidate.userData?.draw;
      if (typeof draw === "function") {
        draw();
      }
    }
  }

  dispose(): void {
    this.context.getExtension("WEBGL_lose_context")?.["loseContext"]?.();
  }
}

export type ReactPortal = ReactNode;

export const createPortal = (
  child: ReactNode,
  container: Element,
): ReactPortal => {
  void container;
  return child;
};

export class Color {
  constructor(
    public r: number,
    public g?: number,
    public b?: number,
  ) {}
}

export const DoubleSide = "DoubleSide";
export const ClampToEdgeWrapping = "ClampToEdgeWrapping";
export const LinearFilter = "LinearFilter";
