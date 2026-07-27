export type PerformanceTier = "high" | "medium" | "low" | "critical";

export type PerformanceProfile = {
  readonly tier: PerformanceTier;
  readonly frameDivisor: number;
  readonly preserveGlState: boolean;
  readonly enablePixelCap: boolean;
  readonly maxDevicePixelRatio: number;
};

export const PERFORMANCE_TIER: Record<PerformanceTier, PerformanceProfile> = {
  high: {
    tier: "high",
    frameDivisor: 1,
    preserveGlState: true,
    enablePixelCap: false,
    maxDevicePixelRatio: 3,
  },
  medium: {
    tier: "medium",
    frameDivisor: 1,
    preserveGlState: true,
    enablePixelCap: false,
    maxDevicePixelRatio: 2,
  },
  low: {
    tier: "low",
    frameDivisor: 2,
    preserveGlState: false,
    enablePixelCap: true,
    maxDevicePixelRatio: 1.5,
  },
  critical: {
    tier: "critical",
    frameDivisor: 3,
    preserveGlState: false,
    enablePixelCap: true,
    maxDevicePixelRatio: 1,
  },
};

export const DEFAULT_PERFORMANCE_TIER: PerformanceTier = "medium";

export function resolveDevicePixelRatio(
  devicePixelRatio: number,
  tier: PerformanceTier = DEFAULT_PERFORMANCE_TIER,
): number {
  const profile = PERFORMANCE_TIER[tier];
  const safeDpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 1;
  const cap = profile?.maxDevicePixelRatio ?? 3;

  return Math.min(safeDpr, Math.max(1, cap));
}

export function resolveFrameDivisor(tier: PerformanceTier): number {
  return PERFORMANCE_TIER[tier]?.frameDivisor ?? 1;
}
