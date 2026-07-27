import type { HeroSection as HeroSectionData } from "@/content";
import Image from "next/image";

import UIButton from "@/components/ui/button";

type HeroSectionProps = {
  readonly section: HeroSectionData;
};

export default function HeroSection({ section }: HeroSectionProps) {
  const headingId = `${section.id}-heading`;

  return (
    <section
      id={section.id}
      className="section section-surface hero-section"
      aria-labelledby={headingId}
    >
      <div
        className="section-motion-visual"
        data-motion="reveal,parallax"
        data-motion-reveal-distance="28px"
        data-motion-reveal-threshold="0.2"
        data-motion-parallax-speed="0.12"
        data-motion-parallax-axis="y"
      >
        <div className="section-head">
          <p className="eyebrow">Home</p>
          <h1 id={headingId}>{section.title}</h1>
        </div>
        <h2 className="hero-subtitle">{section.subtitle}</h2>
        <p className="hero-description">{section.intro}</p>
        {section.visual ? (
          <div className="hero-media-wrap">
            <Image
              className="hero-image"
              src={section.visual.src}
              alt={section.visual.alt}
              width={section.visual.width ?? 1200}
              height={section.visual.height ?? 900}
              priority
            />
          </div>
        ) : null}
        <div className="section-cta-row">
          {section.ctas.map((cta) => (
            <UIButton key={cta.label} href={cta.href} variant="primary">
              {cta.label}
            </UIButton>
          ))}
        </div>
      </div>
    </section>
  );
}
