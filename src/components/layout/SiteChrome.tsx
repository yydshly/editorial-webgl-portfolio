import type { ReactNode } from "react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import SkipLink from "@/components/accessibility/SkipLink";

type NavItem = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

type SiteChromeProps = {
  readonly children: ReactNode;
  readonly brandName: string;
  readonly navItems: readonly NavItem[];
};

export default function SiteChrome({
  children,
  brandName,
  navItems,
}: SiteChromeProps) {
  return (
    <>
      <SkipLink />
      <Header brandName={brandName} navItems={navItems} />
      <div className="site-content">
        {children}
      </div>
      <Footer brandName={brandName} />
    </>
  );
}
