import Link from "next/link";

type FooterLink = {
  readonly label: string;
  readonly href: string;
};

type FooterProps = {
  readonly brandName: string;
  readonly footerLinks: readonly FooterLink[];
};

export default function Footer({ brandName, footerLinks }: FooterProps) {
  return (
    <footer className="site-footer">
      <p className="site-footer__brand">{brandName}</p>
      <ul className="site-footer__links" aria-label="Footer links">
        {footerLinks.map((link) => (
          <li key={link.label}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
      <p className="site-footer__copyright">
        © {new Date().getFullYear()} {brandName}. All rights reserved.
      </p>
    </footer>
  );
}
