import * as THREE from "three";

export type HeroForegroundUvRect = {
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
};

export type HeroForegroundScreenRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly center: {
    readonly x: number;
    readonly y: number;
  };
  readonly width: number;
  readonly height: number;
};

export type HeroForegroundRegistrationLayout = {
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly scale: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly expectedScreenRect: HeroForegroundScreenRect;
  readonly cropWorldCenter: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly depthScale: number;
};

type RegistrationLayoutInput = {
  readonly portraitMesh: THREE.Mesh;
  readonly camera: THREE.PerspectiveCamera;
  readonly crop: HeroForegroundUvRect;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly depthOffsetPx: number;
  readonly relativeTranslateXpx: number;
  readonly relativeTranslateYpx: number;
  readonly relativeScale: number;
};

const MIN_VIEW_DEPTH = 0.0001;
const MIN_VIEWPORT_HEIGHT = 1;

export function resolveHeroForegroundRegistrationLayout({
  portraitMesh,
  camera,
  crop,
  viewport,
  depthOffsetPx,
  relativeTranslateXpx,
  relativeTranslateYpx,
  relativeScale,
}: RegistrationLayoutInput): HeroForegroundRegistrationLayout {
  camera.updateMatrixWorld();
  portraitMesh.updateMatrixWorld(true);

  const normalizedCrop = normalizeCrop(crop);
  const cropCenterLocal = new THREE.Vector3(
    (normalizedCrop.uMin + normalizedCrop.uMax) * 0.5 - 0.5,
    0.5 - (normalizedCrop.vMin + normalizedCrop.vMax) * 0.5,
    0,
  );
  const cropWorldCenter = portraitMesh.localToWorld(cropCenterLocal.clone());
  const expectedScreenRect = projectMeshLocalRect(
    portraitMesh,
    camera,
    viewport,
    {
      minX: normalizedCrop.uMin - 0.5,
      maxX: normalizedCrop.uMax - 0.5,
      minY: 0.5 - normalizedCrop.vMax,
      maxY: 0.5 - normalizedCrop.vMin,
    },
  );
  const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
  const cameraForward = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const cameraToCrop = cropWorldCenter.clone().sub(cameraPosition);
  const sourceViewDepth = Math.max(MIN_VIEW_DEPTH, cameraToCrop.dot(cameraForward));
  const safeViewportHeight = Math.max(MIN_VIEWPORT_HEIGHT, viewport.height);
  const visibleHeight =
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * sourceViewDepth;
  const worldUnitsPerPixel = visibleHeight / safeViewportHeight;
  const targetViewDepth = Math.max(
    MIN_VIEW_DEPTH,
    sourceViewDepth - depthOffsetPx * worldUnitsPerPixel,
  );
  const depthScale = targetViewDepth / sourceViewDepth;
  const targetScreen = {
    x: expectedScreenRect.center.x + relativeTranslateXpx,
    y: expectedScreenRect.center.y + relativeTranslateYpx,
  };
  const targetPosition = unprojectAtViewDepth(
    targetScreen,
    viewport,
    camera,
    targetViewDepth,
    cameraPosition,
    cameraForward,
  );
  const safeRelativeScale =
    Number.isFinite(relativeScale) && relativeScale >= 0 ? relativeScale : 1;

  return {
    position: {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
    },
    scale: {
      x:
        portraitMesh.scale.x *
        (normalizedCrop.uMax - normalizedCrop.uMin) *
        depthScale *
        safeRelativeScale,
      y:
        portraitMesh.scale.y *
        (normalizedCrop.vMax - normalizedCrop.vMin) *
        depthScale *
        safeRelativeScale,
      z: 1,
    },
    expectedScreenRect,
    cropWorldCenter: {
      x: cropWorldCenter.x,
      y: cropWorldCenter.y,
      z: cropWorldCenter.z,
    },
    depthScale,
  };
}

export function projectMeshLocalRect(
  mesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  viewport: {
    readonly width: number;
    readonly height: number;
  },
  rect: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  },
): HeroForegroundScreenRect {
  camera.updateMatrixWorld();
  mesh.updateMatrixWorld(true);

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
    center: {
      x: (left + right) * 0.5,
      y: (top + bottom) * 0.5,
    },
    width: right - left,
    height: bottom - top,
  };
}

function normalizeCrop(crop: HeroForegroundUvRect): HeroForegroundUvRect {
  const uMin = clamp(crop.uMin, 0, 1);
  const uMax = clamp(crop.uMax, uMin, 1);
  const vMin = clamp(crop.vMin, 0, 1);
  const vMax = clamp(crop.vMax, vMin, 1);

  return { uMin, uMax, vMin, vMax };
}

function unprojectAtViewDepth(
  screen: { readonly x: number; readonly y: number },
  viewport: { readonly width: number; readonly height: number },
  camera: THREE.PerspectiveCamera,
  viewDepth: number,
  cameraPosition: THREE.Vector3,
  cameraForward: THREE.Vector3,
): THREE.Vector3 {
  const ndcX = (screen.x / Math.max(1, viewport.width)) * 2 - 1;
  const ndcY = 1 - (screen.y / Math.max(1, viewport.height)) * 2;
  const rayDirection = new THREE.Vector3(ndcX, ndcY, 0.5)
    .unproject(camera)
    .sub(cameraPosition)
    .normalize();
  const denominator = Math.max(MIN_VIEW_DEPTH, rayDirection.dot(cameraForward));

  return cameraPosition.clone().addScaledVector(rayDirection, viewDepth / denominator);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
