import { describe, expect, it } from "vitest";

import { collectDeclarations, summarizeDeclarations } from "./run-rc-e2e-baseline.mjs";

function report(specs) {
  return {
    suites: [
      {
        specs: specs.map((spec) => ({
          file: spec.file ?? "browser-integration.spec.ts",
          line: spec.line,
          title: spec.title,
          tests: [
            {
              expectedStatus: spec.expectedStatus ?? "passed",
              projectId: "chromium",
              results: [{ status: spec.status }],
            },
          ],
        })),
      },
    ],
  };
}

describe("RC E2E baseline aggregation", () => {
  it("replaces serial omissions with exact follow-up results and preserves conditional skips", () => {
    const primary = collectDeclarations(
      report([
        { line: 10, title: "passes", status: "passed" },
        { line: 20, title: "fails", status: "failed" },
        {
          line: 30,
          title: "explicit skip",
          expectedStatus: "skipped",
          status: "skipped",
        },
        { line: 40, title: "serial tail", status: "skipped" },
        { line: 50, title: "opt-in evidence", status: "skipped" },
      ]),
    );
    const followUps = collectDeclarations(
      report([
        { line: 40, title: "serial tail", status: "failed" },
        { line: 50, title: "opt-in evidence", status: "skipped" },
      ]),
    );

    expect(summarizeDeclarations(primary, followUps)).toMatchObject({
      discovered: 5,
      passed: 1,
      failed: 2,
      skipped: 2,
      omitted: 0,
    });
  });

  it("reports a declaration as omitted when no follow-up result exists", () => {
    const primary = collectDeclarations(
      report([{ line: 40, title: "serial tail", status: "skipped" }]),
    );

    expect(summarizeDeclarations(primary, [])).toMatchObject({
      discovered: 1,
      passed: 0,
      failed: 0,
      skipped: 0,
      omitted: 1,
    });
  });
});
