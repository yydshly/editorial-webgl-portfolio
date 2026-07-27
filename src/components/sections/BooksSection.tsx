import Image from "next/image";

import type { BooksSection as BooksSectionData } from "@/content";

import UIButton from "@/components/ui/button";
import SceneAnchor from "@/components/webgl/SceneAnchor";

type BooksSectionProps = {
  readonly section: BooksSectionData;
};

export default function BooksSection({ section }: BooksSectionProps) {
  const headingId = `${section.id}-heading`;
  const seriesLabelId = `${section.id}-series-label`;

  return (
    <section
      id={section.id}
      className="section section-surface books-section"
      aria-labelledby={headingId}
    >
      <div
        className="section-motion-visual"
        data-motion="reveal,parallax"
        data-motion-reveal-threshold="0.15"
        data-motion-parallax-speed="0.06"
        data-motion-parallax-axis="y"
      >
        <div className="books-layout">
          <header className="books-reading">
            <div className="section-head">
              <p className="eyebrow">Publication archive</p>
              <h2 id={headingId}>{section.title}</h2>
              {section.subtitle ? (
                <p className="books-subtitle">{section.subtitle}</p>
              ) : null}
            </div>
            <p className="books-intro">{section.intro}</p>
            <dl className="books-series-meta" aria-label="Publication series">
              <div>
                <dt>Author</dt>
                <dd>{section.author}</dd>
              </div>
              <div>
                <dt>Series</dt>
                <dd id={seriesLabelId}>
                  <span>{section.series.label}</span>
                  <span lang="zh-Hans">{section.series.labelZh}</span>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{section.series.assetStatus} asset study</dd>
              </div>
            </dl>
          </header>

          <SceneAnchor
            anchorId="books-cover-stage"
            sceneType="books-cover-stage"
          />
          <figure
            id="books-cover-stage"
            className="books-cover-stage"
            aria-labelledby={seriesLabelId}
            data-books-fallback-state="unavailable"
          >
            {section.items.map((item) => (
              <picture
                key={item.id}
                className={`books-cover books-cover--${item.role}`}
                data-book-role={item.role}
              >
                <source
                  media="(max-width: 768px)"
                  srcSet={item.cover.mobile.src}
                />
                <Image
                  src={item.cover.desktop.src}
                  alt={item.cover.alt}
                  width={item.cover.desktop.width}
                  height={item.cover.desktop.height}
                  sizes="(max-width: 768px) 48vw, 24vw"
                  unoptimized
                  className="books-cover-image"
                  data-books-fallback="true"
                  data-books-fallback-state="unavailable"
                  data-book-id={item.id}
                />
              </picture>
            ))}
            <figcaption className="books-cover-caption">
              Development cover studies. Publication details and final artwork
              are not yet released.
            </figcaption>
          </figure>

          <ol className="books-list" aria-label="FIELD NOTES publications">
            {section.items.map((item) => {
              const articleHeadingId = `book-${item.id}-heading`;

              return (
                <li key={item.id}>
                  <article
                    className={`book-card book-card--${item.role}`}
                    aria-labelledby={articleHeadingId}
                    data-book-id={item.id}
                  >
                    <header className="book-card__head">
                      <p className="book-card__role">
                        {item.role === "primary"
                          ? "Core publication"
                          : "Related publication"}
                      </p>
                      <h3 id={articleHeadingId} lang="zh-Hans">
                        {item.titleZh}
                      </h3>
                      <p className="book-card__subtitle">{item.subtitleEn}</p>
                    </header>
                    <p className="book-card__meta">
                      <time dateTime={item.year}>{item.year}</time>
                      <span aria-hidden="true">/</span>
                      <span>{item.type}</span>
                    </p>
                    <p>{item.description}</p>
                    <ul
                      className="book-card__topics"
                      aria-label={`Topics for ${item.subtitleEn}`}
                    >
                      {item.topicTags.map((topic) => (
                        <li key={topic}>{topic}</li>
                      ))}
                    </ul>
                    <div className="book-card__fact">
                      <p className="book-card__fact-label">Key fact</p>
                      <p>{item.keyFact}</p>
                    </div>
                    <UIButton
                      type="button"
                      disabled
                      aria-disabled="true"
                      variant="subtle"
                      size="sm"
                      className="book-card__development-cta"
                    >
                      {item.action.label}
                    </UIButton>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
