import type { QuoteSection as QuoteSectionData } from "@/content";

type QuoteSectionProps = {
  readonly section: QuoteSectionData;
};

export default function QuoteSection({ section }: QuoteSectionProps) {
  const headingId = `${section.id}-heading`;

  return (
    <section
      id={section.id}
      className="section section-surface quote-section"
      aria-labelledby={headingId}
    >
      <div
        className="section-motion-visual"
        data-motion="reveal"
        data-motion-reveal-distance="18px"
        data-motion-reveal-threshold="0.12"
      >
        <div className="section-head">
          <p className="eyebrow">Quote</p>
          <h2 id={headingId}>{section.title}</h2>
        </div>
        <blockquote>
          <p>&ldquo;{section.quote}&rdquo;</p>
        </blockquote>
        <p className="quote-source">
          {section.author} · {section.source}
        </p>
      </div>
    </section>
  );
}
