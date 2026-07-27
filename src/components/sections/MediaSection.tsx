import type { MediaSection as MediaSectionData } from "@/content";
import Image from "next/image";

import UIButton from "@/components/ui/button";

type MediaSectionProps = {
  readonly section: MediaSectionData;
};

export default function MediaSection({ section }: MediaSectionProps) {
  const headingId = `${section.id}-heading`;

  return (
    <section
      id={section.id}
      className="section section-surface media-section"
      aria-labelledby={headingId}
    >
      <div
        className="section-motion-visual"
        data-motion="reveal,parallax"
        data-motion-reveal-threshold="0.18"
        data-motion-parallax-speed="0.08"
        data-motion-parallax-axis="y"
      >
        <div className="media-reading" data-media-reading="true">
          <div className="section-head">
            <p className="eyebrow">Media</p>
            <h2 id={headingId} data-media-title="true">{section.title}</h2>
          </div>
          <p data-media-body="true">{section.description}</p>
          <div className="section-cta-row">
            {section.ctas.map((cta) => (
              <UIButton key={cta.label} href={cta.href} variant="primary" data-media-cta="true">
                {cta.label}
              </UIButton>
            ))}
          </div>
        </div>
        <div className="media-grid">
          {section.gallery.map((item) => (
            <article
              key={item.title}
              className={`media-card media-card--${item.image.id === "media-stage" ? "main" : "secondary"}`}
            >
              <Image
                className="media-fallback-image"
                data-media-fallback="true"
                data-media-fallback-slot={item.image.id}
                src={item.image.src}
                alt={item.image.alt}
                width={item.image.width ?? 1280}
                height={item.image.height ?? 720}
              />
              <div className="sr-only">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
