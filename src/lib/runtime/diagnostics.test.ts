import { describe, expect, it } from "vitest";
import { shouldExposeRuntimeDiagnostics } from "./diagnostics";

describe("shouldExposeRuntimeDiagnostics", () => {
  it("hides runtime diagnostics in production unless explicitly enabled", () => {
    expect(
      shouldExposeRuntimeDiagnostics({
        nodeEnv: "production",
        explicitFlag: undefined,
      }),
    ).toBe(false);
    expect(
      shouldExposeRuntimeDiagnostics({
        nodeEnv: "production",
        explicitFlag: "true",
      }),
    ).toBe(true);
  });

  it("keeps diagnostics available to development and test tooling", () => {
    expect(
      shouldExposeRuntimeDiagnostics({ nodeEnv: "development", explicitFlag: undefined }),
    ).toBe(true);
    expect(
      shouldExposeRuntimeDiagnostics({ nodeEnv: "test", explicitFlag: undefined }),
    ).toBe(true);
  });
});
