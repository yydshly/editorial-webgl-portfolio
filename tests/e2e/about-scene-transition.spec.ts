import { expect, test, type Page } from "@playwright/test";

type LifecycleState = {
  readonly resident: boolean;
  readonly visible: boolean;
  readonly updating: boolean;
  readonly dominant: boolean;
  readonly cached: boolean;
  readonly disposed: boolean;
};

type TransitionProbe = {
  readonly scenes: {
    readonly total: number;
    readonly dominant: string | null;
  };
  readonly transition: {
    readonly cameraBlendWeight: number;
    readonly cameraIntentSceneId: string | null;
    readonly dominantSceneId: string | null;
  } | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<Record<string, LifecycleState | null>>;
    readonly sceneSnapshots: Readonly<Record<string, {
      readonly portrait?: {
        readonly isAssetReady?: boolean;
      };
    }>>;
  };
};

test.describe("P4-03 About scene transition policy", () => {
  test("keeps Manifesto idle and resolves forward, reverse, and large-delta About lifecycle coherently", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1_440, height: 900 });
    await page.goto("/");
    await waitForProbe(page);

    await expect
      .poll(async () => {
        const snapshot = await getSnapshot(page);
        return snapshot.diagnostics.sceneStates["about-scene"] ?? null;
      })
      .toMatchObject({
        resident: false,
        visible: false,
        dominant: false,
        cached: false,
        disposed: false,
      });

    const geometry = await page.evaluate(() => {
      const manifesto = document.getElementById("manifesto");
      const about = document.getElementById("about");
      if (!manifesto || !about) {
        throw new Error("Manifesto and About anchors must be mounted.");
      }

      return {
        viewportHeight: window.innerHeight,
        manifestoTop: manifesto.getBoundingClientRect().top + window.scrollY,
        aboutTop: about.getBoundingClientRect().top + window.scrollY,
        aboutHeight: about.getBoundingClientRect().height,
      };
    });

    await scrollTo(page, geometry.aboutTop - geometry.viewportHeight * 1.51);
    expect((await getSnapshot(page)).diagnostics.sceneStates["about-scene"]?.resident).toBe(false);

    await scrollTo(page, geometry.aboutTop - geometry.viewportHeight * 1.5);
    await expect
      .poll(async () => {
        const snapshot = await getSnapshot(page);
        return {
          state: snapshot.diagnostics.sceneStates["about-scene"] ?? null,
          ready:
            snapshot.diagnostics.sceneSnapshots["about-scene"]?.portrait
              ?.isAssetReady ?? false,
        };
      })
      .toMatchObject({
        state: {
          resident: true,
          visible: false,
          dominant: false,
          cached: false,
        },
        ready: true,
      });

    await scrollTo(
      page,
      geometry.manifestoTop - geometry.viewportHeight + 1,
    );
    const manifestoSnapshot = await waitForState(page, (snapshot) =>
      snapshot.diagnostics.sceneStates["media-scene"]?.cached === true,
    );
    expect(manifestoSnapshot.diagnostics.sceneStates["media-scene"]).toMatchObject({
      resident: true,
      visible: false,
      dominant: false,
      cached: true,
    });
    expect(manifestoSnapshot.diagnostics.sceneStates.manifesto).toBeUndefined();
    expect(manifestoSnapshot.transition?.cameraIntentSceneId).toBe("global-idle");
    expect(manifestoSnapshot.transition?.cameraBlendWeight).toBe(0);

    await scrollToFirstFrame(
      page,
      geometry.aboutTop - geometry.viewportHeight * 0.8,
    );
    const aboutSnapshot = await getSnapshot(page);
    expect(aboutSnapshot.diagnostics.sceneStates["about-scene"]?.dominant).toBe(true);
    expect(aboutSnapshot.scenes.dominant).toBe("about-scene");
    expect(aboutSnapshot.transition?.cameraIntentSceneId).toBe("about-scene");
    expect(aboutSnapshot.transition?.cameraBlendWeight).toBe(0);

    await scrollTo(page, geometry.aboutTop - geometry.viewportHeight * 0.81);
    const reverseManifesto = await waitForState(page, (snapshot) =>
      snapshot.diagnostics.sceneStates["about-scene"]?.cached === true,
    );
    expect(reverseManifesto.scenes.dominant).toBeNull();
    expect(reverseManifesto.transition?.cameraIntentSceneId).toBe("global-idle");
    expect(reverseManifesto.transition?.cameraBlendWeight).toBe(0);

    await page.evaluate(
      ({ top, viewportHeight }) => {
        window.scrollTo({ top: Math.max(0, top - viewportHeight * 0.8), behavior: "instant" });
      },
      { top: geometry.aboutTop, viewportHeight: geometry.viewportHeight },
    );
    const reenteredAbout = await waitForState(page, (snapshot) =>
      snapshot.diagnostics.sceneStates["about-scene"]?.dominant === true,
    );
    expect(reenteredAbout.diagnostics.sceneStates["media-scene"]?.cached).toBe(true);
    expect(reenteredAbout.transition?.cameraIntentSceneId).toBe("about-scene");
    expect(reenteredAbout.transition?.cameraBlendWeight).toBe(0);

    await scrollToFirstFrame(
      page,
      geometry.aboutTop +
        geometry.aboutHeight -
        geometry.viewportHeight * 0.2 +
        1,
    );
    const afterAbout = await getSnapshot(page);
    expect(afterAbout.diagnostics.sceneStates["about-scene"]).toMatchObject({
      resident: true,
      visible: false,
      dominant: false,
      cached: true,
    });
    expect(afterAbout.transition?.cameraIntentSceneId).toBe("global-idle");

    await scrollTo(
      page,
      geometry.aboutTop - geometry.viewportHeight * 0.8,
    );
    await waitForState(page, (snapshot) =>
      snapshot.diagnostics.sceneStates["about-scene"]?.dominant === true,
    );
    await scrollToFirstFrame(page, 0);
    const directReverse = await getSnapshot(page);
    expect(directReverse.diagnostics.sceneStates["about-scene"]?.cached).toBe(true);
    expect(directReverse.scenes.dominant).toBe("hero-scene");
    expect(directReverse.transition?.cameraIntentSceneId).toBe("hero-scene");
  });
});

async function waitForProbe(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          typeof (
            window as unknown as {
              __editorialWebGLProbe?: { snapshot(): unknown };
            }
          ).__editorialWebGLProbe?.snapshot === "function",
      ),
    )
    .toBe(true);
}

async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((scrollTop) => {
    window.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" });
  }, top);
  await page.waitForTimeout(120);
}

async function scrollToFirstFrame(page: Page, top: number): Promise<void> {
  await page.evaluate(async (scrollTop) => {
    window.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" });
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }, top);
}

async function getSnapshot(page: Page): Promise<TransitionProbe> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __editorialWebGLProbe?: { snapshot(): TransitionProbe };
      }
    ).__editorialWebGLProbe;
    if (!probe) {
      throw new Error("WebGL performance probe is unavailable.");
    }
    return probe.snapshot();
  });
}

async function waitForState(
  page: Page,
  predicate: (snapshot: TransitionProbe) => boolean,
): Promise<TransitionProbe> {
  let latest: TransitionProbe | null = null;
  await expect
    .poll(async () => {
      latest = await getSnapshot(page);
      return predicate(latest);
    })
    .toBe(true);
  if (!latest) {
    throw new Error("Transition snapshot was unavailable.");
  }
  return latest;
}
