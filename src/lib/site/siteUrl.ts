const DEVELOPMENT_SITE_URL = "https://dev-host-01.example";

export function resolveSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): URL {
  try {
    const url = new URL(value ?? DEVELOPMENT_SITE_URL);
    if (url.protocol !== "https:" || url.username || url.password) {
      return new URL(DEVELOPMENT_SITE_URL);
    }
    return new URL(url.origin);
  } catch {
    return new URL(DEVELOPMENT_SITE_URL);
  }
}
