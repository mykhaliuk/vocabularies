export const getAppUrl = () => {
  const url = process.env.APP_URL;
  const stage = process.env.APP_ENV ?? 'local';
  if (!url) {
    if (stage !== 'local') {
      throw new Error(`[app-url] APP_URL is required when APP_ENV=${stage}`);
    }
    return 'http://localhost:3000';
  }
  return url;
};

// Public origin for assets embedded in emails (the logo). Deliberately NOT
// getAppUrl(): a message sent from dev/preview must not point the logo at that
// per-env origin, which mail image proxies (Apple/Gmail) often cannot reach
// (preview protection, ephemeral hosts) — the broken-image bug in VKB-69.
// Defaults to the production origin so every stage renders the same public
// asset; override with EMAIL_ASSET_ORIGIN. The value is parsed as an absolute
// http(s) URL and normalized to its origin (no path or trailing slash); an
// unset, empty, or invalid value falls back to the default with a warning, so a
// misconfigured knob can never re-break the logo.
const EMAIL_ASSET_ORIGIN_DEFAULT = 'https://vocabu.myka.me';

export const getEmailAssetOrigin = () => {
  const configured = process.env.EMAIL_ASSET_ORIGIN?.trim();
  if (!configured) return EMAIL_ASSET_ORIGIN_DEFAULT;
  try {
    const url = new URL(configured);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.origin;
    }
  } catch {
    // not an absolute URL — fall through to the warning + default below
  }
  console.warn(
    `[email] ignoring invalid EMAIL_ASSET_ORIGIN=${JSON.stringify(configured)};` +
      ` using ${EMAIL_ASSET_ORIGIN_DEFAULT}`,
  );
  return EMAIL_ASSET_ORIGIN_DEFAULT;
};
