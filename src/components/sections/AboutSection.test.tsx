import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSectionByKind } from "@/content";
import RuntimeProvider from "@/lib/motion/RuntimeProvider";

import AboutSection from "./AboutSection";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AboutSection", () => {
  it("renders the DEV-HOST-01 archive as an accessible ordered timeline", () => {
    const about = getSectionByKind("about");

    if (!about) {
      throw new Error("Expected About content to exist");
    }

    render(<AboutSection section={about} />);

    expect(
      screen.getByRole("img", {
        name: "Development placeholder portrait for DEV-HOST-01",
      }),
    ).toHaveAttribute("data-about-fallback", "true");
    expect(
      screen.getByRole("img", {
        name: "Development placeholder portrait for DEV-HOST-01",
      }),
    ).toHaveAttribute("data-about-fallback-state", "unavailable");
    expect(screen.getByRole("list")).toHaveAttribute(
      "aria-label",
      "DEV-HOST-01 archive timeline",
    );

    [
      "Observation becomes expression",
      "Learning the work behind the story",
      "Bringing research in front of the camera",
      "Cross-cultural public expression",
    ].forEach((title) => {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    });

    expect(screen.getAllByText("Key fact")).toHaveLength(4);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(document.getElementById("about-portrait")).toHaveClass(
      "about-portrait-region",
    );
    expect(screen.getAllByRole("listitem").map((stage) => stage.dataset.aboutStageIndex)).toEqual([
      "0",
      "1",
      "2",
      "3",
    ]);
    expect(screen.getAllByRole("listitem").map((stage) => stage.dataset.aboutStageState)).toEqual([
      "current",
      "rest",
      "rest",
      "rest",
    ]);
  });

  it("uses the same section viewport-entry progress semantics as AboutScene", () => {
    const about = getSectionByKind("about");

    if (!about) {
      throw new Error("Expected About content to exist");
    }

    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback as FrameRequestCallback);
      return callbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { getAllByRole, unmount } = render(
      <RuntimeProvider>
        <AboutSection section={about} />
      </RuntimeProvider>,
    );
    const section = document.getElementById(about.id);

    if (!section) {
      throw new Error("Expected About section to mount");
    }

    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 500,
      top: 500,
      right: 1000,
      bottom: 1500,
      left: 0,
      width: 1000,
      height: 1000,
      toJSON: () => ({}),
    });

    act(() => {
      callbacks.shift()?.(16);
    });

    expect(
      getAllByRole("listitem").map(
        (stage) => stage.dataset.aboutStageState,
      ),
    ).toEqual(["previous", "current", "rest", "rest"]);

    unmount();
  });
});
