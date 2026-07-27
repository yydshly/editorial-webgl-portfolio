import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";
import ExperienceRoot from "@/components/webgl/ExperienceRoot";
import RuntimeProvider from "@/lib/motion/RuntimeProvider";
import LenisProvider from "@/lib/scroll/LenisProvider";
import { getSiteContent } from "@/content";
import { resolveSiteUrl } from "@/lib/site/siteUrl";

const { brand, seo } = getSiteContent();
const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: seo.title,
    template: `${seo.title} | %s`,
  },
  description: seo.description,
  keywords: [
    "editorial",
    "development archive",
    "DOM-first",
    "accessibility",
    "WebGL fallback",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: seo.title,
    description: seo.description,
    type: "website",
    url: siteUrl,
    siteName: brand.name,
    locale: "en_US",
    images: [
      {
        url: seo.shareImage ?? "/assets/placeholders/og-image.svg",
        alt: "DEV-HOST-01 development archive hero image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
  },
  robots: {
    index: false,
    follow: false,
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const { brand, nav } = getSiteContent();

  return (
    <html lang="en">
      <body className="app-shell">
        <RuntimeProvider>
          <LenisProvider>
            <ExperienceRoot>
              <SiteChrome brandName={brand.name} navItems={nav}>
                {children}
              </SiteChrome>
            </ExperienceRoot>
          </LenisProvider>
        </RuntimeProvider>
      </body>
    </html>
  );
}
