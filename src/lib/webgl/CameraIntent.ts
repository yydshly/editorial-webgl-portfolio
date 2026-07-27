export type CameraIntentVector = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type CameraIntent = {
  readonly target: CameraIntentVector;
  readonly positionOffset: CameraIntentVector;
  readonly fovIntent: number;
  readonly depthBias: number;
  readonly weight: number;
};

export type SceneCameraIntent = {
  readonly sceneId: string;
  readonly intent: Readonly<CameraIntent>;
};
