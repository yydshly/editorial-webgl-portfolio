type FooterProps = {
  readonly brandName: string;
};

export default function Footer({ brandName }: FooterProps) {
  return (
    <footer className="site-footer">
      <p className="site-footer__brand">{brandName}</p>
      <p className="site-footer__note">
        Fictional development archive. DEV-HOST-01 is not a real person, and
        FIELD NOTES are concept publications. No public contact, ticketing,
        purchasing, publishing, or person-related commercial service is
        offered here.
      </p>
      <p className="site-footer__copyright">
        © {new Date().getFullYear()} {brandName}. Development use only.
      </p>
    </footer>
  );
}
