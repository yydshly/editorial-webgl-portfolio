import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FAILURE_STATUSES = new Set(["failed", "timedOut", "interrupted"]);

function visitSuites(suites, declarations) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.at(-1) ?? null;
        declarations.push({
          key: [
            spec.file,
            spec.line,
            spec.title,
            test.projectId ?? "unknown-project",
          ].join("::"),
          file: spec.file,
          line: spec.line,
          title: spec.title,
          projectId: test.projectId ?? "unknown-project",
          expectedStatus: test.expectedStatus ?? "passed",
          status: result?.status ?? "missing",
          error: stripAnsi(result?.error?.message ?? ""),
          attachments: (result?.attachments ?? [])
            .map((attachment) => attachment.path)
            .filter(Boolean),
        });
      }
    }
    visitSuites(suite.suites, declarations);
  }
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

export function collectDeclarations(report) {
  const declarations = [];
  visitSuites(report.suites, declarations);
  return declarations;
}

export function summarizeDeclarations(primary, followUps) {
  const followUpByKey = new Map(
    followUps.map((declaration) => [declaration.key, declaration]),
  );
  const tests = primary.map((declaration) => {
    if (declaration.expectedStatus === "skipped") {
      return { ...declaration, outcome: "skipped", source: "primary" };
    }
    if (declaration.status === "passed") {
      return { ...declaration, outcome: "passed", source: "primary" };
    }
    if (FAILURE_STATUSES.has(declaration.status)) {
      return { ...declaration, outcome: "failed", source: "primary" };
    }
    if (declaration.status !== "skipped") {
      return { ...declaration, outcome: "omitted", source: "primary" };
    }

    const followUp = followUpByKey.get(declaration.key);
    if (!followUp) {
      return { ...declaration, outcome: "omitted", source: "follow-up-missing" };
    }
    if (followUp.status === "passed") {
      return { ...followUp, outcome: "passed", source: "follow-up" };
    }
    if (FAILURE_STATUSES.has(followUp.status)) {
      return { ...followUp, outcome: "failed", source: "follow-up" };
    }
    if (followUp.status === "skipped") {
      return { ...followUp, outcome: "skipped", source: "follow-up" };
    }
    return { ...followUp, outcome: "omitted", source: "follow-up" };
  });

  return {
    discovered: tests.length,
    passed: tests.filter((test) => test.outcome === "passed").length,
    failed: tests.filter((test) => test.outcome === "failed").length,
    skipped: tests.filter((test) => test.outcome === "skipped").length,
    omitted: tests.filter((test) => test.outcome === "omitted").length,
    tests,
  };
}

function readReport(reportPath) {
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function writeJson(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function waitForServer(url, serverProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Next development server exited with ${serverProcess.exitCode}.`);
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function stopServer(serverProcess) {
  if (serverProcess.exitCode !== null) {
    return;
  }
  serverProcess.kill();
  await Promise.race([
    new Promise((resolve) => serverProcess.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

function exactFollowUpTargets(primary) {
  return [
    ...new Map(
      primary
        .filter(
          (test) =>
            test.expectedStatus !== "skipped" && test.status === "skipped",
        )
        .map((test) => [
          `${test.file}:${test.line}`,
          {
            selector: `tests/e2e/${test.file}:${test.line}`,
            line: test.line,
          },
        ]),
    ).values(),
  ];
}

function loadExistingReportSet(directory) {
  const primaryPath = path.join(
    directory,
    "full-e2e-primary-dev-workers1.json",
  );
  const followUpPaths = fs
    .readdirSync(directory)
    .filter((name) => /^serial-tail-\d+\.json$/.test(name))
    .sort((left, right) => Number.parseInt(left.match(/\d+/)[0], 10) -
      Number.parseInt(right.match(/\d+/)[0], 10))
    .map((name) => path.join(directory, name));
  return { primaryPath, followUpPaths };
}

function aggregateReportSet(primaryPath, followUpPaths) {
  const primary = collectDeclarations(readReport(primaryPath));
  const followUps = followUpPaths.flatMap((reportPath) =>
    collectDeclarations(readReport(reportPath)),
  );
  return summarizeDeclarations(primary, followUps);
}

async function runBaseline() {
  const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const artifactDirectory = path.resolve(
    process.env.RC_E2E_ARTIFACT_DIR ??
      "artifacts/release-candidate/rc00/automated",
  );
  const port = Number.parseInt(process.env.RC_E2E_PORT ?? "3220", 10);
  const baseURL = `http://127.0.0.1:${port}`;
  const nextDistDir = process.env.NEXT_DIST_DIR ?? `.tmp/next-rc-e2e-${port}`;
  const nextTsconfigPath = path.join(
    root,
    ".tmp",
    `tsconfig.rc-e2e-${port}.json`,
  );
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const playwrightBin = path.join(
    root,
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
  );
  const primaryPath = path.join(artifactDirectory, "primary.json");
  const followUpDirectory = path.join(artifactDirectory, "follow-ups");
  const summaryPath = path.join(artifactDirectory, "execution-summary.json");

  fs.mkdirSync(followUpDirectory, { recursive: true });
  fs.mkdirSync(path.dirname(nextTsconfigPath), { recursive: true });
  writeJson(nextTsconfigPath, { extends: "../tsconfig.json" });
  const stdout = fs.createWriteStream(
    path.join(artifactDirectory, "server.stdout.log"),
  );
  const stderr = fs.createWriteStream(
    path.join(artifactDirectory, "server.stderr.log"),
  );
  const serverProcess = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_DIST_DIR: nextDistDir,
        NEXT_TSCONFIG_PATH: path.relative(root, nextTsconfigPath),
      },
      stdio: ["ignore", stdout, stderr],
      windowsHide: true,
    },
  );

  try {
    await waitForServer(baseURL, serverProcess);
    const sharedEnv = {
      ...process.env,
      PLAYWRIGHT_PORT: String(port),
      PLAYWRIGHT_OUTPUT_DIR: path.join(artifactDirectory, "test-results"),
    };
    await runProcess(
      process.execPath,
      [
        playwrightBin,
        "test",
        "--config=playwright.rc.config.ts",
        "--reporter=json",
        "--workers=1",
      ],
      {
        cwd: root,
        env: { ...sharedEnv, PLAYWRIGHT_JSON_OUTPUT_NAME: primaryPath },
      },
    );

    const primary = collectDeclarations(readReport(primaryPath));
    const followUpPaths = [];
    for (const target of exactFollowUpTargets(primary)) {
      const reportPath = path.join(
        followUpDirectory,
        `line-${target.line}.json`,
      );
      followUpPaths.push(reportPath);
      await runProcess(
        process.execPath,
        [
          playwrightBin,
          "test",
          target.selector,
          "--config=playwright.rc.config.ts",
          "--reporter=json",
          "--workers=1",
        ],
        {
          cwd: root,
          env: {
            ...sharedEnv,
            PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
          },
        },
      );
    }

    const summary = aggregateReportSet(primaryPath, followUpPaths);
    writeJson(summaryPath, {
      generatedAt: new Date().toISOString(),
      baseURL,
      primaryReport: path.relative(root, primaryPath),
      followUpReports: followUpPaths.map((reportPath) =>
        path.relative(root, reportPath),
      ),
      ...summary,
    });
    process.stdout.write(
      `RC E2E: ${summary.discovered} discovered / ${summary.passed} passed / ` +
        `${summary.failed} failed / ${summary.skipped} skipped / ` +
        `${summary.omitted} omitted\n`,
    );
    process.exitCode = summary.failed > 0 || summary.omitted > 0 ? 1 : 0;
  } finally {
    await stopServer(serverProcess);
    stdout.end();
    stderr.end();
  }
}

function printHelp() {
  process.stdout.write(`Usage:
  pnpm test:e2e:rc
  node scripts/run-rc-e2e-baseline.mjs --summarize-existing [directory]

Environment:
  RC_E2E_PORT          isolated development port (default: 3220)
  RC_E2E_ARTIFACT_DIR  ignored raw-report directory
  NEXT_DIST_DIR        isolated Next build directory
`);
}

async function main() {
  const command = process.argv[2];
  if (command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "--summarize-existing") {
    const directory = path.resolve(
      process.argv[3] ?? "artifacts/release-candidate/rc00",
    );
    const { primaryPath, followUpPaths } = loadExistingReportSet(directory);
    const summary = aggregateReportSet(primaryPath, followUpPaths);
    const outputPath = path.join(directory, "execution-summary.json");
    writeJson(outputPath, {
      generatedAt: new Date().toISOString(),
      primaryReport: path.relative(process.cwd(), primaryPath),
      followUpReports: followUpPaths.map((reportPath) =>
        path.relative(process.cwd(), reportPath),
      ),
      ...summary,
    });
    process.stdout.write(
      `RC E2E: ${summary.discovered} discovered / ${summary.passed} passed / ` +
        `${summary.failed} failed / ${summary.skipped} skipped / ` +
        `${summary.omitted} omitted\n`,
    );
    return;
  }
  await runBaseline();
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
