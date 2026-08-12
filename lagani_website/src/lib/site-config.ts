const DEFAULT_SITE_URL = "http://localhost:3000";

function parseHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function parseOrigin(value: string | undefined): string | undefined {
  const parsedValue = parseHttpUrl(value);
  if (!parsedValue) return undefined;
  const parsed = new URL(parsedValue);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
  return parsed.origin;
}

function parseEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export function getPublicSiteConfig() {
  const appStoreUrl = parseHttpUrl(process.env.NEXT_PUBLIC_APP_STORE_URL);
  const playStoreUrl = parseHttpUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL);
  const configuredSiteUrl = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  return {
    appStoreUrl,
    playStoreUrl,
    hasDownloadLink: Boolean(appStoreUrl || playStoreUrl),
    siteUrl: new URL(configuredSiteUrl ?? DEFAULT_SITE_URL),
    supportEmail: parseEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  } as const;
}
