type FooterProps = {
  readonly brandName: string;
};

export default function Footer({ brandName }: FooterProps) {
  return (
    <footer className="site-footer">
      <p className="site-footer__brand">{brandName}</p>
      <p className="site-footer__note">
        Fictional development archive. No public contact, ticketing, or sales
        routes are published here.
      </p>
      <p className="site-footer__copyright">
        © {new Date().getFullYear()} {brandName}. Development use only.
      </p>
    </footer>
  );
}
