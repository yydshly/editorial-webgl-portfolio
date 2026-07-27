import type { AboutSection as AboutSectionData } from "@/content";

import Image from "next/image";

import { resolveAboutTimelineStagePresentation } from "@/lib/webgl/about/AboutChapterProgress";
import { ABOUT_PORTRAIT_ANCHOR_ID } from "@/lib/webgl/about/aboutSceneConfig";
import SceneAnchor from "@/components/webgl/SceneAnchor";

import AboutTimelineStageController from "./AboutTimelineStageController";

type AboutSectionProps = {
  readonly section: AboutSectionData;
};

export default function AboutSection({ section }: AboutSectionProps) {
  const headingId = `${section.id}-heading`;
  const initialStageStates = resolveAboutTimelineStagePresentation(0);

  return (
    <section
      id={section.id}
      className="section section-surface about-section"
      aria-labelledby={headingId}
    >
      <AboutTimelineStageController
        sectionId={section.id}
        portraitAnchorId={ABOUT_PORTRAIT_ANCHOR_ID}
      />
      <div
        className="section-motion-visual about-archive"
        data-motion="reveal"
        data-motion-reveal-threshold="0.18"
      >
        <SceneAnchor
          anchorId={ABOUT_PORTRAIT_ANCHOR_ID}
          sceneType="about-portrait"
        />
        <figure
          id={ABOUT_PORTRAIT_ANCHOR_ID}
          className="about-portrait-region"
        >
          <Image
            className="about-fallback-image"
            data-about-fallback="true"
            data-about-fallback-state="unavailable"
            src={section.portrait.src}
            alt={section.portrait.alt}
            width={section.portrait.width}
            height={section.portrait.height}
          />
          <figcaption>DEV-HOST-01 / archive portrait</figcaption>
        </figure>

        <div className="about-reading">
          <header className="section-head">
            <p className="eyebrow">Archive</p>
            <h2 id={headingId}>{section.title}</h2>
          </header>
          <p className="lead">{section.intro}</p>

          <ol className="about-timeline" aria-label="DEV-HOST-01 archive timeline">
            {section.timeline.map((stage, index) => (
              <li
                key={stage.id}
                className="about-stage"
                data-about-stage-index={index}
                data-about-stage-state={initialStageStates[index]}
              >
                <article>
                  <p className="about-stage__meta">
                    <time dateTime={stage.year}>{stage.year}</time>
                    <span aria-hidden="true"> · </span>
                    <span>{stage.place}</span>
                  </p>
                  <h3>{stage.title}</h3>
                  {stage.body.map((paragraph) => (
                    <p key={paragraph} className="about-stage__body">
                      {paragraph}
                    </p>
                  ))}
                  <p className="about-stage__fact">
                    <span className="about-stage__fact-label">Key fact</span>
                    {stage.keyFact}
                  </p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
