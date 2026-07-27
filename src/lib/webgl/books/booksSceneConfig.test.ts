import { describe, expect, it } from "vitest";

import {
  BOOKS_ENTER_DELAYS,
  BOOKS_MOBILE_BREAKPOINT,
  booksSceneMotionConfig,
} from "./booksSceneConfig";

describe("booksSceneMotionConfig", () => {
  it("contains one complete role tuple for each viewport and authored phase endpoint", () => {
    expect(BOOKS_MOBILE_BREAKPOINT).toBe(768);

    for (const viewport of ["desktop", "mobile"] as const) {
      for (const phase of ["enter", "hold", "depart"] as const) {
        expect(Object.keys(booksSceneMotionConfig[viewport][phase])).toEqual([
          "primary",
          "secondary-left",
          "secondary-right",
        ]);
        expect(
          booksSceneMotionConfig[viewport][phase].primary.visualRole,
        ).toBe("primary");
      }
    }
  });

  it("keeps authored enter delays and subordinate hold opacity in the shared config", () => {
    expect(BOOKS_ENTER_DELAYS).toEqual({
      primary: 0,
      "secondary-left": 0.18,
      "secondary-right": 0.28,
    });

    for (const viewport of ["desktop", "mobile"] as const) {
      expect(
        booksSceneMotionConfig[viewport].hold["secondary-left"].opacity,
      ).toBe(0.92);
      expect(
        booksSceneMotionConfig[viewport].hold["secondary-right"].opacity,
      ).toBe(0.86);
    }
  });
});
