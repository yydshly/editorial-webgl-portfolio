import { getAllSections, type SiteSection } from "@/content";

import AboutSection from "@/components/sections/AboutSection";
import BooksSection from "@/components/sections/BooksSection";
import HeroSection from "@/components/sections/HeroSection";
import ManifestoSection from "@/components/sections/ManifestoSection";
import MediaSection from "@/components/sections/MediaSection";
import NewsSection from "@/components/sections/NewsSection";
import QuoteSection from "@/components/sections/QuoteSection";
import SectionMotionController from "@/components/animation/SectionMotionController";
import SceneAnchor from "@/components/webgl/SceneAnchor";
import { Fragment } from "react";

function renderSection(section: SiteSection) {
  switch (section.kind) {
    case "hero":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="hero" />
          <HeroSection section={section} />
        </Fragment>
      );
    case "manifesto":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="manifesto" />
          <ManifestoSection section={section} />
        </Fragment>
      );
    case "media":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="media" />
          <MediaSection section={section} />
        </Fragment>
      );
    case "about":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="about" />
          <AboutSection section={section} />
        </Fragment>
      );
    case "news":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="news" />
          <NewsSection section={section} />
        </Fragment>
      );
    case "quote":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="quote" />
          <QuoteSection section={section} />
        </Fragment>
      );
    case "books":
      return (
        <Fragment key={section.id}>
          <SceneAnchor anchorId={section.id} sceneType="books" />
          <BooksSection section={section} />
        </Fragment>
      );
    default:
      return null;
  }
}

export default function HomePage() {
  const sections: readonly SiteSection[] = getAllSections();

  return (
    <main
      id="site-content"
      className="site-main"
      aria-label="DEV-HOST-01 development editorial archive"
      tabIndex={-1}
    >
      <SectionMotionController />
      {sections.map(renderSection)}
    </main>
  );
}
