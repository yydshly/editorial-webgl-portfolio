export type Locale = "en" | "zh-CN";

export type SectionKind =
  | "hero"
  | "manifesto"
  | "media"
  | "about"
  | "news"
  | "quote"
  | "books";

export type TextTone = "default" | "strong" | "subtle";

export interface SEOData {
  title: string;
  description: string;
  robots?: {
    index?: boolean;
    follow?: boolean;
  };
  shareImage?: string;
}

export interface ImageAsset {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface CTA {
  label: string;
  href: string;
  target?: "_self" | "_blank";
}

export interface BaseSection<K extends SectionKind> {
  readonly id: string;
  readonly kind: K;
  readonly title: string;
  readonly subtitle?: string;
  readonly order: number;
  readonly hidden?: boolean;
}

export interface HeroSection extends BaseSection<"hero"> {
  readonly tone: TextTone;
  readonly intro: string;
  readonly ctas: readonly CTA[];
  readonly visual?: ImageAsset;
}

export interface ManifestoSection extends BaseSection<"manifesto"> {
  readonly tone: TextTone;
  readonly lead: string;
  readonly points: readonly {
    readonly title: string;
    readonly detail: string;
  }[];
  readonly ctas: readonly CTA[];
}

export interface MediaSection extends BaseSection<"media"> {
  readonly tone: TextTone;
  readonly description: string;
  readonly ctas: readonly CTA[];
  readonly gallery: readonly {
    readonly title: string;
    readonly image: ImageAsset;
    readonly description: string;
  }[];
}

export interface AboutTimelineStage {
  readonly id: string;
  readonly year: string;
  readonly place: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly keyFact: string;
}

export interface AboutSection extends BaseSection<"about"> {
  readonly tone: TextTone;
  readonly intro: string;
  readonly portrait: ImageAsset;
  readonly timeline: readonly AboutTimelineStage[];
}

export interface NewsSection extends BaseSection<"news"> {
  readonly tone: TextTone;
  readonly ctas: readonly CTA[];
  readonly posts: readonly {
    readonly date: string;
    readonly title: string;
    readonly summary: string;
  }[];
}

export interface QuoteSection extends BaseSection<"quote"> {
  readonly tone: TextTone;
  readonly quote: string;
  readonly author: string;
  readonly source: string;
}

export type BookRole = "primary" | "secondary-left" | "secondary-right";

export type BookVisualSubject =
  | "person-led"
  | "scene-led"
  | "relationship-led";

export interface DevelopmentCTA {
  readonly label: string;
  readonly status: "development";
}

export interface BookCoverAssets {
  readonly masterSemanticId: string;
  readonly alt: string;
  readonly desktop: ImageAsset;
  readonly mobile: ImageAsset;
}

export interface BookPublication {
  readonly id: string;
  readonly role: BookRole;
  readonly visualSubject: BookVisualSubject;
  readonly titleZh: string;
  readonly subtitleEn: string;
  readonly year: string;
  readonly type: string;
  readonly description: string;
  readonly topicTags: readonly string[];
  readonly keyFact: string;
  readonly cover: BookCoverAssets;
  readonly action: DevelopmentCTA;
}

export interface BooksSection extends BaseSection<"books"> {
  readonly tone: TextTone;
  readonly intro: string;
  readonly author: "DEV-HOST-01";
  readonly series: {
    readonly label: "FIELD NOTES";
    readonly labelZh: "在场档案";
    readonly assetStatus: "development";
  };
  readonly items: readonly [
    BookPublication,
    BookPublication,
    BookPublication,
  ];
}

export type SiteSection =
  | HeroSection
  | ManifestoSection
  | MediaSection
  | AboutSection
  | NewsSection
  | QuoteSection
  | BooksSection;

export interface BrandData {
  readonly name: string;
  readonly domain: string;
  readonly description: string;
}

export interface SiteData {
  readonly locale: Locale;
  readonly brand: BrandData;
  readonly seo: SEOData;
  readonly nav: readonly {
    readonly id: SectionKind;
    readonly label: string;
    readonly href: string;
  }[];
  readonly sections: readonly SiteSection[];
}
