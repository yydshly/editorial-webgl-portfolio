import type { ManifestoSection as ManifestoSectionData } from "@/content";

import UIButton from "@/components/ui/button";

type ManifestoSectionProps = {
  readonly section: ManifestoSectionData;
};

export default function ManifestoSection({ section }: ManifestoSectionProps) {
  return (
    <section
      id={section.id}
      className="section section-surface manifesto-section"
    >
      <div
        className="section-motion-visual"
        data-motion="reveal"
        data-motion-reveal-distance="24px"
        data-motion-reveal-threshold="0.2"
      >
        <div className="section-head">
          <p className="eyebrow">Manifesto</p>
          <h2>{section.title}</h2>
        </div>
        <p className="lead">{section.lead}</p>
        <ul className="manifesto-list">
          {section.points.map((point) => (
            <li key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.detail}</p>
            </li>
          ))}
        </ul>
        <div className="section-cta-row">
          {section.ctas.map((cta) => (
            <UIButton key={cta.label} href={cta.href} variant="ghost">
              {cta.label}
            </UIButton>
          ))}
        </div>
      </div>
    </section>
  );
}
