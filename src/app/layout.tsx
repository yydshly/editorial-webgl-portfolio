import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";
import ExperienceRoot from "@/components/webgl/ExperienceRoot";
import RuntimeProvider from "@/lib/motion/RuntimeProvider";
import LenisProvider from "@/lib/scroll/LenisProvider";
import { getSiteContent } from "@/content";

const { brand, seo } = getSiteContent();

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trevornoah.com"),
  title: {
    default: seo.title,
    template: `${seo.title} | %s`,
  },
  description: seo.description,
  keywords: [
    "Trevor Noah",
    "editorial",
    "portfolio",
    "entertainment",
    "media",
  ],
  openGraph: {
    title: seo.title,
    description: seo.description,
    type: "website",
    url: "https://www.trevornoah.com",
    siteName: brand.name,
    locale: "en_US",
    images: [
      {
        url: seo.shareImage ?? "/assets/placeholders/og-image.svg",
        alt: "Trevor Noah Style hero image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
    site: "@example",
  },
  robots: {
    index: true,
    follow: true,
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
