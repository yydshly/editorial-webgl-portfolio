export type BooksAssetStatus = "development";
export type BooksAssetAvailability = "manifest-only" | "packaged";
export type BooksCoverRole =
  | "primary"
  | "secondary-left"
  | "secondary-right";
export type BooksVisualSubject =
  | "person-led"
  | "scene-led"
  | "relationship-led";

export type BooksNormalizedPoint = {
  readonly x: number;
  readonly y: number;
};

export type BooksNormalizedBounds = BooksNormalizedPoint & {
  readonly width: number;
  readonly height: number;
};

export type BooksSourceAsset = {
  readonly path: string;
  readonly width: number;
  readonly height: number;
};

export type BooksAssetVariant = BooksSourceAsset & {
  readonly crop: BooksNormalizedBounds;
};

export type BooksCoverAsset = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly author: "DEV-HOST-01";
  readonly series: "FIELD NOTES";
  readonly status: "development";
  readonly visualRole: BooksCoverRole;
  readonly visualSubject: BooksVisualSubject;
  readonly masterSemanticId: string;
  readonly source: BooksSourceAsset;
  readonly desktop: BooksAssetVariant;
  readonly mobile: BooksAssetVariant;
  readonly focalPoint: BooksNormalizedPoint;
  readonly expectedCoverBounds: BooksNormalizedBounds;
  readonly colorSpace: "sRGB";
};

export type BooksAssetManifest = {
  readonly seriesId: "field-notes";
  readonly seriesLabel: "FIELD NOTES";
  readonly seriesLabelZh: "在场档案";
  readonly author: "DEV-HOST-01";
  readonly status: BooksAssetStatus;
  readonly assetAvailability: BooksAssetAvailability;
  readonly mobileBreakpoint: number;
  readonly colorSpace: "sRGB";
  readonly covers: readonly [
    BooksCoverAsset,
    BooksCoverAsset,
    BooksCoverAsset,
  ];
};

type UnknownRecord = Record<string, unknown>;

const MANIFEST_PREFIX = "Books asset manifest";
const ROLE_ORDER: readonly BooksCoverRole[] = [
  "primary",
  "secondary-left",
  "secondary-right",
];

const ASSET_DIMENSIONS = {
  source: { width: 1200, height: 1800 },
  desktop: { width: 1000, height: 1500 },
  mobile: { width: 800, height: 1200 },
} as const;

const BOOK_CONTRACT = {
  "people-in-the-room": {
    title: "在场的人",
    subtitle: "People in the Room",
    role: "primary",
    subject: "person-led",
  },
  "between-the-cities": {
    title: "城市之间",
    subtitle: "Between the Cities",
    role: "secondary-left",
    subject: "scene-led",
  },
  "hearing-one-another": {
    title: "彼此听见",
    subtitle: "Hearing One Another",
    role: "secondary-right",
    subject: "relationship-led",
  },
} as const;

function asRecord(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${MANIFEST_PREFIX} ${path} must be an object.`);
  }

  return value as UnknownRecord;
}

function requireString(
  record: UnknownRecord,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.${key} must be a non-empty string.`,
    );
  }

  return value;
}

function requireLiteral<T extends string>(
  record: UnknownRecord,
  key: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = requireString(record, key, path);
  if (!allowed.includes(value as T)) {
    const choices = allowed.map((choice) => `"${choice}"`).join(" or ");
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.${key} must be ${choices}.`,
    );
  }

  return value as T;
}

function requirePositiveInteger(
  record: UnknownRecord,
  key: string,
  path: string,
): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.${key} must be a positive integer.`,
    );
  }

  return value as number;
}

function requireNormalizedNumber(
  record: UnknownRecord,
  key: string,
  path: string,
): number {
  const value = record[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.${key} must be between 0 and 1.`,
    );
  }

  return value;
}

function requireAssetPath(
  record: UnknownRecord,
  key: string,
  path: string,
): string {
  const assetPath = requireString(record, key, path);
  let decodedPath = assetPath;

  try {
    for (let pass = 0; pass < 4; pass += 1) {
      const nextPath = decodeURIComponent(decodedPath);
      if (nextPath === decodedPath) {
        break;
      }
      decodedPath = nextPath;
    }
  } catch {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.${key} must be a valid URI path.`,
    );
  }

  const unsafeSegments = decodedPath
    .split("/")
    .some((segment) => segment === "." || segment === "..");
  const unsafeCharacters =
    decodedPath.includes("\\") ||
    decodedPath.includes("?") ||
    decodedPath.includes("#") ||
    decodedPath.includes("%");

  if (
    !(decodedPath.startsWith("/assets/books/") || decodedPath.startsWith("/assets-source/books/")) ||
    unsafeSegments ||
    unsafeCharacters
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.${key} must stay inside /assets/books/.`,
    );
  }

  return assetPath;
}

function parsePoint(value: unknown, path: string): BooksNormalizedPoint {
  const record = asRecord(value, path);
  return Object.freeze({
    x: requireNormalizedNumber(record, "x", path),
    y: requireNormalizedNumber(record, "y", path),
  });
}

function parseBounds(value: unknown, path: string): BooksNormalizedBounds {
  const record = asRecord(value, path);
  const bounds = {
    x: requireNormalizedNumber(record, "x", path),
    y: requireNormalizedNumber(record, "y", path),
    width: requireNormalizedNumber(record, "width", path),
    height: requireNormalizedNumber(record, "height", path),
  };

  if (
    bounds.width === 0 ||
    bounds.height === 0 ||
    bounds.x + bounds.width > 1 ||
    bounds.y + bounds.height > 1
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path} must remain inside normalized source bounds.`,
    );
  }

  return Object.freeze(bounds);
}

function parseSource(
  value: unknown,
  path: string,
  expectedDimensions: { readonly width: number; readonly height: number },
): BooksSourceAsset {
  const record = asRecord(value, path);
  const asset = {
    path: requireAssetPath(record, "path", path),
    width: requirePositiveInteger(record, "width", path),
    height: requirePositiveInteger(record, "height", path),
  };

  if (asset.width * 3 !== asset.height * 2) {
    throw new Error(`${MANIFEST_PREFIX} ${path} must use a 2:3 cover ratio.`);
  }
  if (
    asset.width !== expectedDimensions.width ||
    asset.height !== expectedDimensions.height
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path} must be exactly ${expectedDimensions.width}x${expectedDimensions.height}.`,
    );
  }

  return Object.freeze(asset);
}

function parseVariant(
  value: unknown,
  path: string,
  expectedDimensions: { readonly width: number; readonly height: number },
): BooksAssetVariant {
  const record = asRecord(value, path);
  return Object.freeze({
    ...parseSource(value, path, expectedDimensions),
    crop: parseBounds(record.crop, `${path}.crop`),
  });
}

function pointInside(
  point: BooksNormalizedPoint,
  bounds: BooksNormalizedBounds,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function parseCover(value: unknown, index: number): BooksCoverAsset {
  const path = `covers[${index}]`;
  const record = asRecord(value, path);
  const id = requireString(record, "id", path);
  const contract = BOOK_CONTRACT[id as keyof typeof BOOK_CONTRACT];

  if (!contract) {
    throw new Error(`${MANIFEST_PREFIX} ${path}.id is not an approved book id.`);
  }

  const title = requireString(record, "title", path);
  const subtitle = requireString(record, "subtitle", path);
  const visualRole = requireLiteral(
    record,
    "visualRole",
    path,
    ROLE_ORDER,
  );
  const visualSubject = requireLiteral(
    record,
    "visualSubject",
    path,
    ["person-led", "scene-led", "relationship-led"] as const,
  );
  const masterSemanticId = requireString(record, "masterSemanticId", path);
  const source = parseSource(
    record.source,
    `${path}.source`,
    ASSET_DIMENSIONS.source,
  );
  const desktop = parseVariant(
    record.desktop,
    `${path}.desktop`,
    ASSET_DIMENSIONS.desktop,
  );
  const mobile = parseVariant(
    record.mobile,
    `${path}.mobile`,
    ASSET_DIMENSIONS.mobile,
  );
  const focalPoint = parsePoint(record.focalPoint, `${path}.focalPoint`);
  const expectedCoverBounds = parseBounds(
    record.expectedCoverBounds,
    `${path}.expectedCoverBounds`,
  );

  if (title !== contract.title || subtitle !== contract.subtitle) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path} title and subtitle must match the approved book id.`,
    );
  }
  if (
    visualRole !== contract.role ||
    visualSubject !== contract.subject
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path} visualRole and visualSubject must match the approved book id.`,
    );
  }
  if (masterSemanticId !== `field-notes:${id}:v1`) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.masterSemanticId must identify the shared master semantic.`,
    );
  }
  if (
    source.path !== `/assets-source/books/${id}-master.png` ||
    desktop.path !== `/assets/books/${id}-desktop.webp` ||
    mobile.path !== `/assets/books/${id}-mobile.webp`
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path} source paths must match the approved master/desktop/mobile files.`,
    );
  }
  if (
    !pointInside(focalPoint, desktop.crop) ||
    !pointInside(focalPoint, mobile.crop)
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} ${path}.focalPoint must fall inside both desktop and mobile crops.`,
    );
  }

  return Object.freeze({
    id,
    title,
    subtitle,
    author: requireLiteral(record, "author", path, ["DEV-HOST-01"] as const),
    series: requireLiteral(record, "series", path, ["FIELD NOTES"] as const),
    status: requireLiteral(record, "status", path, ["development"] as const),
    visualRole,
    visualSubject,
    masterSemanticId,
    source,
    desktop,
    mobile,
    focalPoint,
    expectedCoverBounds,
    colorSpace: requireLiteral(record, "colorSpace", path, ["sRGB"] as const),
  });
}

export function parseBooksAssetManifest(value: unknown): BooksAssetManifest {
  const record = asRecord(value, "root");
  const rawCovers = record.covers;

  if (!Array.isArray(rawCovers) || rawCovers.length !== 3) {
    throw new Error(`${MANIFEST_PREFIX} root.covers must contain exactly three covers.`);
  }

  const rawCoverRecords = rawCovers.map((cover, index) =>
    asRecord(cover, `covers[${index}]`),
  );
  const rawIds = rawCoverRecords.map((cover, index) =>
    requireString(cover, "id", `covers[${index}]`),
  );
  const rawRoles = rawCoverRecords.map((cover, index) =>
    requireLiteral(
      cover,
      "visualRole",
      `covers[${index}]`,
      ROLE_ORDER,
    ),
  );

  if (new Set(rawIds).size !== rawIds.length) {
    throw new Error(`${MANIFEST_PREFIX} covers must use unique ids.`);
  }
  if (
    new Set(rawRoles).size !== ROLE_ORDER.length ||
    !ROLE_ORDER.every((role) => rawRoles.includes(role))
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} covers must contain exactly one cover for each visualRole.`,
    );
  }

  const covers = rawCovers.map(parseCover);
  const ids = new Set(covers.map((cover) => cover.id));
  const roles = new Set(covers.map((cover) => cover.visualRole));
  const semantics = new Set(
    covers.map((cover) => cover.masterSemanticId),
  );

  if (ids.size !== covers.length) {
    throw new Error(`${MANIFEST_PREFIX} covers must use unique ids.`);
  }
  if (
    roles.size !== ROLE_ORDER.length ||
    !ROLE_ORDER.every((role) => roles.has(role))
  ) {
    throw new Error(
      `${MANIFEST_PREFIX} covers must contain exactly one cover for each visualRole.`,
    );
  }
  if (semantics.size !== covers.length) {
    throw new Error(
      `${MANIFEST_PREFIX} covers must use one unique masterSemanticId per book.`,
    );
  }

  const orderedCovers = ROLE_ORDER.map((role) => {
    const cover = covers.find((candidate) => candidate.visualRole === role);
    if (!cover) {
      throw new Error(
        `${MANIFEST_PREFIX} covers must contain exactly one cover for each visualRole.`,
      );
    }
    return cover;
  }) as [BooksCoverAsset, BooksCoverAsset, BooksCoverAsset];

  return Object.freeze({
    seriesId: requireLiteral(record, "seriesId", "root", ["field-notes"] as const),
    seriesLabel: requireLiteral(record, "seriesLabel", "root", ["FIELD NOTES"] as const),
    seriesLabelZh: requireLiteral(record, "seriesLabelZh", "root", ["在场档案"] as const),
    author: requireLiteral(record, "author", "root", ["DEV-HOST-01"] as const),
    status: requireLiteral(record, "status", "root", ["development"] as const),
    assetAvailability: requireLiteral(
      record,
      "assetAvailability",
      "root",
      ["manifest-only", "packaged"] as const,
    ),
    mobileBreakpoint: requirePositiveInteger(
      record,
      "mobileBreakpoint",
      "root",
    ),
    colorSpace: requireLiteral(record, "colorSpace", "root", ["sRGB"] as const),
    covers: Object.freeze(orderedCovers),
  });
}

export const booksAssetManifest = parseBooksAssetManifest(manifestJson);

export function getBooksCoverById(
  id: string,
): BooksCoverAsset | undefined {
  return booksAssetManifest.covers.find((cover) => cover.id === id);
}
import manifestJson from "../../../../public/assets/books/books-manifest.json";
