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
// asset; override with EMAIL_ASSET_ORIGIN if the public host changes. Trailing
// slashes are trimmed so `${origin}/icon-192.png` never doubles up.
export const getEmailAssetOrigin = () => {
  // `||`, not `??`: an env set-but-empty (as .env.example ships it) must fall
  // back too — an empty origin would yield a host-less `/icon-192.png` and
  // re-break the logo. trim() also rejects a whitespace-only value.
  const configured = process.env.EMAIL_ASSET_ORIGIN?.trim();
  const origin = configured || 'https://vocabu.myka.me';
  return origin.replace(/\/+$/, '');
};
