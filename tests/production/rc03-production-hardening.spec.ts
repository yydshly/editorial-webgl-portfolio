import { expect, test } from "@playwright/test";

test("applies production security headers and keeps runtime diagnostics private", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await expect.poll(() => page.evaluate(() => ({
    probe: "__editorialWebGLProbe" in window,
    blendDebug: "__r3bBlendDebug" in window,
  }))).toEqual({ probe: false, blendDebug: false });
});
