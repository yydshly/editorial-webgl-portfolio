"use client";

type WebGLFallbackProps = {
  readonly reason?: string | null;
};

export default function WebGLFallback({ reason }: WebGLFallbackProps) {
  return (
    <aside className="webgl-fallback" role="status" aria-live="polite">
      <p>WebGL stage disabled: {reason ?? "running in fallback mode."}</p>
    </aside>
  );
}
