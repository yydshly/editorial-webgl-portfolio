export type RuntimeDiagnosticsEnvironment = {
  readonly nodeEnv?: string;
  readonly explicitFlag?: string;
};

export function shouldExposeRuntimeDiagnostics({
  nodeEnv = process.env.NODE_ENV,
  explicitFlag = process.env.NEXT_PUBLIC_ENABLE_RUNTIME_DIAGNOSTICS,
}: RuntimeDiagnosticsEnvironment = {}): boolean {
  return nodeEnv !== "production" || explicitFlag === "true";
}
