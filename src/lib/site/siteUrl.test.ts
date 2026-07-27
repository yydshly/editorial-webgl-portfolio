import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./siteUrl";

describe("resolveSiteUrl", () => {
  it("uses the safe development domain when no public URL is configured", () => {
    expect(resolveSiteUrl(undefined).toString()).toBe("https://dev-host-01.example/");
  });

  it("normalizes an explicitly configured public origin", () => {
    expect(resolveSiteUrl("https://archive.example/path/").toString()).toBe(
      "https://archive.example/",
    );
  });
});
