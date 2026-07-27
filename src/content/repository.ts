import type {
  AboutSection,
  BooksSection,
  HeroSection,
  ImageAsset,
  ManifestoSection,
  MediaSection,
  NewsSection,
  QuoteSection,
  SEOData,
  SiteData,
  SiteSection,
} from "./types";

const heroVisual: ImageAsset = {
  id: "hero-visual",
  src: "/assets/hero/hero-placeholder-desktop.webp",
  alt: "Development placeholder presenter portrait",
  width: 1024,
  height: 1536,
};

const heroSection: HeroSection = {
  id: "hero",
  kind: "hero",
  order: 1,
  tone: "strong",
  title: "Trevor Noah Style Experience",
  subtitle: "Editorial storytelling for global audiences",
  intro:
    "A premium, narrative-first digital house that balances performance with cultural storytelling.",
  ctas: [
    { label: "Watch latest", href: "#news" },
    { label: "Tickets", href: "/tickets" },
  ],
  visual: heroVisual,
};

const manifestoSection: ManifestoSection = {
  id: "manifesto",
  kind: "manifesto",
  order: 3,
  tone: "default",
  title: "Manifesto",
  subtitle: "What drives the platform",
  lead: "Showcase personality-driven storytelling with editorial discipline and clarity.",
  points: [
    {
      title: "Narrative over noise",
      detail: "Each section has one objective and one visual rhythm.",
    },
    {
      title: "Audience first",
      detail: "Information hierarchy is tuned for scan-first reading and accessible navigation.",
    },
    {
      title: "Craft over volume",
      detail: "Visual polish is earned through restrained rhythm and intentional spacing.",
    },
  ],
  ctas: [{ label: "Read manifesto", href: "#about" }],
};

const mediaSection: MediaSection = {
  id: "media",
  kind: "media",
  order: 2,
  tone: "subtle",
  title: "Media",
  subtitle: "Selected visual moments",
  description:
    "A compact gallery baseline for stage and studio assets, used later for cinematic transitions.",
  ctas: [{ label: "Explore stories", href: "#news" }],
  gallery: [
    {
      title: "Live Stage Capture",
      image: {
        id: "media-stage",
        src: "/assets/media/media-stage-desktop.webp",
        alt: "Development placeholder presenter on stage under warm spotlights",
        width: 1280,
        height: 800,
      },
      description: "High contrast portrait under editorial spotlight.",
    },
    {
      title: "Studio Portrait",
      image: {
        id: "media-studio",
        src: "/assets/media/media-studio-desktop.webp",
        alt: "Development placeholder presenter in a studio portrait",
        width: 1280,
        height: 800,
      },
      description: "Press-ready image style with muted palette.",
    },
  ],
};

const aboutSection: AboutSection = {
  id: "about",
  kind: "about",
  order: 4,
  tone: "default",
  title: "About",
  subtitle: "DEV-HOST-01 archive",
  intro:
    "An editorial record of the work, places, and conversations that shape DEV-HOST-01's cross-cultural practice.",
  portrait: {
    id: "about-development-portrait",
    src: "/assets/about/about-portrait-desktop.webp",
    alt: "Development placeholder portrait for DEV-HOST-01",
    width: 1024,
    height: 1280,
  },
  timeline: [
    {
      id: "origin",
      year: "2010",
      place: "Xi'an",
      title: "Observation becomes expression",
      body: [
        "She grows up in Xi'an and becomes attentive to character stories, interviews, and public expression.",
        "School writing and small interviews teach her to observe people together with their environment.",
      ],
      keyFact: "Completes her first character interview and campus feature.",
    },
    {
      id: "industry",
      year: "2015",
      place: "Shanghai",
      title: "Learning the work behind the story",
      body: [
        "She joins a content team and begins with topic selection, research organisation, and scripting.",
        "The work gives her a working understanding of interview structure and person-led narrative.",
      ],
      keyFact: "Joins a content team and takes responsibility for topics and drafting.",
    },
    {
      id: "on-camera",
      year: "2020",
      place: "Beijing",
      title: "Bringing research in front of the camera",
      body: [
        "A formal hosting opportunity turns backstage experience into an on-camera practice.",
        "Her style becomes measured, clear, and centred on the person being interviewed.",
      ],
      keyFact: "Hosts her first formal interview programme.",
    },
    {
      id: "cross-cultural",
      year: "2026",
      place: "New York",
      title: "Cross-cultural public expression",
      body: [
        "She makes interview and content projects for people with different cultural backgrounds.",
        "Her working identity now spans host, content creator, and public speaker.",
      ],
      keyFact:
        "Launches and independently produces a cross-cultural content project.",
    },
  ],
};

const newsSection: NewsSection = {
  id: "news",
  kind: "news",
  order: 5,
  tone: "default",
  title: "News",
  subtitle: "Recent updates",
  ctas: [{ label: "View all news", href: "/news" }],
  posts: [
    {
      date: "2026-07-20",
      title: "Trevor Noah announces a new international tour stop",
      summary:
        "The route adds more documentary-style show moments with city-based fan experiences.",
      href: "/news/international-tour",
    },
    {
      date: "2026-06-30",
      title: "Season 2 of media specials enters post-production",
      summary:
        "A new production cycle focuses on sharper social and personal storytelling.",
      href: "/news/season-2",
    },
  ],
};

const quoteSection: QuoteSection = {
  id: "quote",
  kind: "quote",
  order: 6,
  tone: "subtle",
  title: "Quote",
  subtitle: "Brand voice sample",
  quote:
    "Humor lands best when it is precise, human, and rooted in lived reality.",
  author: "Trevor Noah",
  source: "Audience interview",
};

const booksSection: BooksSection = {
  id: "books",
  kind: "books",
  order: 7,
  tone: "default",
  title: "Books",
  subtitle: "FIELD NOTES publication archive",
  intro:
    "Three publication studies trace a body of work from close character interviews to city observation and cross-cultural public expression.",
  author: "DEV-HOST-01",
  series: {
    label: "FIELD NOTES",
    labelZh: "在场档案",
    assetStatus: "development",
  },
  items: [
    {
      id: "people-in-the-room",
      role: "primary",
      visualSubject: "person-led",
      titleZh: "在场的人",
      subtitleEn: "People in the Room",
      year: "2022",
      type: "Interview essays",
      description:
        "Long-form interviews and field notes about how individual lives take shape inside shared rooms, institutions, and public conversations.",
      topicTags: ["人物访谈", "个体故事", "公共表达"],
      keyFact:
        "Built from sustained interview notes rather than retrospective biography.",
      cover: {
        masterSemanticId: "field-notes:people-in-the-room:v1",
        alt: "Development cover for 在场的人 (People in the Room) by DEV-HOST-01",
        desktop: {
          id: "people-in-the-room-desktop",
          src: "/assets/books/people-in-the-room-desktop.webp",
          alt: "Development cover for 在场的人 (People in the Room) by DEV-HOST-01",
          width: 1000,
          height: 1500,
        },
        mobile: {
          id: "people-in-the-room-mobile",
          src: "/assets/books/people-in-the-room-mobile.webp",
          alt: "Development cover for 在场的人 (People in the Room) by DEV-HOST-01",
          width: 800,
          height: 1200,
        },
      },
      action: {
        label: "Publication details in development",
        status: "development",
      },
    },
    {
      id: "between-the-cities",
      role: "secondary-left",
      visualSubject: "scene-led",
      titleZh: "城市之间",
      subtitleEn: "Between the Cities",
      year: "2024",
      type: "City essays",
      description:
        "Essays on movement, work, belonging, and the public spaces that connect one urban life to another.",
      topicTags: ["城市观察", "迁移", "公共空间"],
      keyFact:
        "Organised around transitional spaces instead of a city-by-city travelogue.",
      cover: {
        masterSemanticId: "field-notes:between-the-cities:v1",
        alt: "Development cover for 城市之间 (Between the Cities) by DEV-HOST-01",
        desktop: {
          id: "between-the-cities-desktop",
          src: "/assets/books/between-the-cities-desktop.webp",
          alt: "Development cover for 城市之间 (Between the Cities) by DEV-HOST-01",
          width: 1000,
          height: 1500,
        },
        mobile: {
          id: "between-the-cities-mobile",
          src: "/assets/books/between-the-cities-mobile.webp",
          alt: "Development cover for 城市之间 (Between the Cities) by DEV-HOST-01",
          width: 800,
          height: 1200,
        },
      },
      action: {
        label: "Publication details in development",
        status: "development",
      },
    },
    {
      id: "hearing-one-another",
      role: "secondary-right",
      visualSubject: "relationship-led",
      titleZh: "彼此听见",
      subtitleEn: "Hearing One Another",
      year: "2026",
      type: "Conversation essays",
      description:
        "Dialogues on listening, translation, and the conditions that make cross-cultural public expression possible.",
      topicTags: ["倾听", "跨文化沟通", "公共表达"],
      keyFact:
        "Pairs different cultural contexts without presenting either side as explanatory authority.",
      cover: {
        masterSemanticId: "field-notes:hearing-one-another:v1",
        alt: "Development cover for 彼此听见 (Hearing One Another) by DEV-HOST-01",
        desktop: {
          id: "hearing-one-another-desktop",
          src: "/assets/books/hearing-one-another-desktop.webp",
          alt: "Development cover for 彼此听见 (Hearing One Another) by DEV-HOST-01",
          width: 1000,
          height: 1500,
        },
        mobile: {
          id: "hearing-one-another-mobile",
          src: "/assets/books/hearing-one-another-mobile.webp",
          alt: "Development cover for 彼此听见 (Hearing One Another) by DEV-HOST-01",
          width: 800,
          height: 1200,
        },
      },
      action: {
        label: "Publication details in development",
        status: "development",
      },
    },
  ],
};

const seo: SEOData = {
  title: "Trevor Noah Style Website",
  description:
    "A production-ready, SEO-oriented editorial website for a global personality brand.",
  shareImage: "/assets/placeholders/og-image.svg",
};

const siteContent: SiteData = {
  locale: "en",
  brand: {
    name: "Trevor Noah Style",
    domain: "www.trevornoah.com",
    description: "Editorial style portfolio and media story system.",
  },
  seo,
  nav: [
    { id: "hero", label: "Hero", href: "#hero" },
    { id: "media", label: "Media", href: "#media" },
    { id: "manifesto", label: "Manifesto", href: "#manifesto" },
    { id: "about", label: "About", href: "#about" },
    { id: "news", label: "News", href: "#news" },
    { id: "quote", label: "Quote", href: "#quote" },
    { id: "books", label: "Books", href: "#books" },
  ],
  sections: [
    heroSection,
    manifestoSection,
    mediaSection,
    aboutSection,
    newsSection,
    quoteSection,
    booksSection,
  ],
};

function normalizeSections(sections: readonly SiteSection[]): SiteSection[] {
  return [...sections].sort((a, b) => a.order - b.order);
}

export function getSiteContent(): SiteData {
  return {
    ...siteContent,
    sections: normalizeSections(siteContent.sections),
  };
}

export function getAllSections(): readonly SiteSection[] {
  return getSiteContent().sections;
}

export function getSectionByKind<K extends SiteSection["kind"]>(
  kind: K,
): Extract<SiteSection, { kind: K }> | undefined {
  return getAllSections().find(
    (section): section is Extract<SiteSection, { kind: K }> =>
      section.kind === kind,
  );
}

export const getBrandData = () => getSiteContent().brand;
export const getSEOData = () => getSiteContent().seo;
