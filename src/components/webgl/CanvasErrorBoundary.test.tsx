import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CanvasErrorBoundary from "@/components/webgl/CanvasErrorBoundary";

function Boom() {
  throw new Error("explode");
  return null;
}

describe("CanvasErrorBoundary", () => {
  it("renders fallback on render error", () => {
    const { getByText } = render(
      <CanvasErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </CanvasErrorBoundary>,
    );
    expect(getByText("fallback")).toBeTruthy();
  });
});
