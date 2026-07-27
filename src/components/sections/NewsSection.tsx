import type { NewsSection as NewsSectionData } from "@/content";

import UIButton from "@/components/ui/button";

type NewsSectionProps = {
  readonly section: NewsSectionData;
};

export default function NewsSection({ section }: NewsSectionProps) {
  return (
    <section id={section.id} className="section section-surface news-section">
      <div
        className="section-motion-visual"
        data-motion="reveal"
        data-motion-reveal-threshold="0.16"
      >
        <div className="section-head">
          <p className="eyebrow">News</p>
          <h2>{section.title}</h2>
        </div>
        <div className="news-list">
          {section.posts.map((post) => (
            <article key={post.title} className="news-item">
              <time dateTime={post.date}>{post.date}</time>
              <h3>
                <UIButton href={post.href} variant="subtle" size="sm">
                  {post.title}
                </UIButton>
              </h3>
              <p>{post.summary}</p>
            </article>
          ))}
        </div>
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
