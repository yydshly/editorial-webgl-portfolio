import manifestJson from "../../../../public/assets/about/about-manifest.json";

export type AboutAssetStatus = "development" | "production";
export type AboutAssetAvailability = "manifest-only" | "packaged";

type AboutAssetDimensions = {
  readonly path: string;
  readonly width: number;
  readonly height: number;
};

type AboutNormalizedPoint = {
  readonly x: number;
  readonly y: number;
};

type AboutNormalizedBounds = AboutNormalizedPoint & {
  readonly width: number;
  readonly height: number;
};

export type AboutAssetVariant = AboutAssetDimensions & {
  readonly crop: AboutNormalizedBounds;
  readonly focalPoint: AboutNormalizedPoint;
};

export type AboutAssetManifest = {
  readonly assetId: string;
  readonly identity: "DEV-HOST-01";
  readonly status: AboutAssetStatus;
  readonly assetAvailability: AboutAssetAvailability;
  readonly mobileBreakpoint: number;
  readonly master: AboutAssetDimensions;
  readonly desktop: AboutAssetVariant;
  readonly mobile: AboutAssetVariant;
  readonly subjectBounds: AboutNormalizedBounds;
  readonly colorSpace: "sRGB";
  readonly composition: {
    readonly subjectPosition: "left";
    readonly gazeDirection: "right";
    readonly breathingRoom: "right";
    readonly sameMasterSemantic: true;
  };
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`About asset manifest ${path} must be an object.`);
  }

  return value as UnknownRecord;
}

function requireString(record: UnknownRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`About asset manifest ${path}.${key} must be a non-empty string.`);
  }

  return value;
}

function requireAssetPath(record: UnknownRecord, path: string): string {
  const assetPath = requireString(record, "path", path);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(assetPath);
  } catch {
    throw new Error(`About asset manifest ${path}.path must be a valid URI path.`);
  }

  const escapesAboutDirectory = decodedPath.includes("\\") || decodedPath.split("/").some((segment) => segment === "." || segment === "..");
  if (
    !(decodedPath.startsWith("/assets/about/") || decodedPath.startsWith("/assets-source/about/")) ||
    escapesAboutDirectory
  ) {
    throw new Error(`About asset manifest ${path}.path must stay inside the approved About asset directories.`);
  }

  return assetPath;
}

function requirePositiveInteger(record: UnknownRecord, key: string, path: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`About asset manifest ${path}.${key} must be a positive integer.`);
  }

  return value as number;
}

function requireNormalisedNumber(record: UnknownRecord, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`About asset manifest ${path}.${key} must be a normalised number between 0 and 1.`);
  }

  return value;
}

function parseDimensions(value: unknown, path: string): AboutAssetDimensions {
  const record = asRecord(value, path);
  return {
    path: requireAssetPath(record, path),
    width: requirePositiveInteger(record, "width", path),
    height: requirePositiveInteger(record, "height", path),
  };
}

function parsePoint(value: unknown, path: string): AboutNormalizedPoint {
  const record = asRecord(value, path);
  return {
    x: requireNormalisedNumber(record, "x", path),
    y: requireNormalisedNumber(record, "y", path),
  };
}

function parseBounds(value: unknown, path: string): AboutNormalizedBounds {
  const record = asRecord(value, path);
  const bounds = {
    x: requireNormalisedNumber(record, "x", path),
    y: requireNormalisedNumber(record, "y", path),
    width: requireNormalisedNumber(record, "width", path),
    height: requireNormalisedNumber(record, "height", path),
  };

  if (bounds.width === 0 || bounds.height === 0 || bounds.x + bounds.width > 1 || bounds.y + bounds.height > 1) {
    throw new Error(`About asset manifest ${path} must remain within normalised source bounds.`);
  }

  return bounds;
}

function parseVariant(value: unknown, path: string): AboutAssetVariant {
  const record = asRecord(value, path);
  const crop = parseBounds(record.crop, `${path}.crop`);
  const focalPoint = parsePoint(record.focalPoint, `${path}.focalPoint`);

  if (
    focalPoint.x < crop.x ||
    focalPoint.x > crop.x + crop.width ||
    focalPoint.y < crop.y ||
    focalPoint.y > crop.y + crop.height
  ) {
    throw new Error(`About asset manifest ${path}.focalPoint must fall inside ${path}.crop.`);
  }

  return {
    ...parseDimensions(record, path),
    crop,
    focalPoint,
  };
}

export function parseAboutAssetManifest(value: unknown): AboutAssetManifest {
  const record = asRecord(value, "root");
  const status = requireString(record, "status", "root");
  const assetAvailability = requireString(record, "assetAvailability", "root");
  const identity = requireString(record, "identity", "root");
  const colorSpace = requireString(record, "colorSpace", "root");
  const composition = asRecord(record.composition, "composition");

  if (identity !== "DEV-HOST-01") {
    throw new Error('About asset manifest identity must be "DEV-HOST-01".');
  }
  if (status !== "development" && status !== "production") {
    throw new Error('About asset manifest status must be "development" or "production".');
  }
  if (assetAvailability !== "manifest-only" && assetAvailability !== "packaged") {
    throw new Error('About asset manifest assetAvailability must be "manifest-only" or "packaged".');
  }
  if (colorSpace !== "sRGB") {
    throw new Error('About asset manifest colorSpace must be "sRGB".');
  }
  if (
    composition.subjectPosition !== "left" ||
    composition.gazeDirection !== "right" ||
    composition.breathingRoom !== "right" ||
    composition.sameMasterSemantic !== true
  ) {
    throw new Error("About asset manifest composition must preserve the left-subject/right-look/right-breathing-room same-master semantic.");
  }

  return {
    assetId: requireString(record, "assetId", "root"),
    identity,
    status,
    assetAvailability,
    mobileBreakpoint: requirePositiveInteger(record, "mobileBreakpoint", "root"),
    master: parseDimensions(record.master, "master"),
    desktop: parseVariant(record.desktop, "desktop"),
    mobile: parseVariant(record.mobile, "mobile"),
    subjectBounds: parseBounds(record.subjectBounds, "subjectBounds"),
    colorSpace,
    composition: {
      subjectPosition: "left",
      gazeDirection: "right",
      breathingRoom: "right",
      sameMasterSemantic: true,
    },
  };
}

export const aboutAssetManifest = parseAboutAssetManifest(manifestJson);

export function selectAboutPortraitSource(viewportWidth: number): string {
  if (Number.isFinite(viewportWidth) && viewportWidth > 0 && viewportWidth <= aboutAssetManifest.mobileBreakpoint) {
    return aboutAssetManifest.mobile.path;
  }

  return aboutAssetManifest.desktop.path;
}
