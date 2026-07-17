// Branded HTML email shell — the reusable seam every Vocabu transactional email
// renders into (VKB-55 ships the first one, magic-link). Deliberately thin: an
// outer document with the logo header, a card, and a footer, plus the
// server-side copy lookup and a {placeholder} interpolator. No template
// registry, no per-type dispatch until a second email exists.
//
// Email clients strip <style> and drop var() custom properties, so the design
// system tokens (assets/css/theme-light.css, tokens.css) are inlined here as
// literal values. ds:check never scans server/, so these are an unguarded third
// copy of the palette — each is annotated with the token it mirrors; keep them
// in sync with the manifest by hand.
import en from '~/i18n/locales/en.json';
import fr from '~/i18n/locales/fr.json';
import uk from '~/i18n/locales/uk.json';
import type { LandingLocale } from '~/shared/landing-locales';

export const EMAIL_BRAND = {
  paper: '#fbfeff', // --paper (app canvas)
  surface: '#ffffff', // --surface (card)
  ink: '#1b1d1e', // --ink (body text)
  inkMuted: '#61676c', // --ink-2 (meta, footer)
  hairline: '#eaedef', // --hairline (borders, dividers)
  link: '#1681bc', // --link (--blue-600)
  action: '#cf3a60', // --primary-action (AA-safe on white; NOT raw --rose-500)
  onAction: '#ffffff', // --text-on-accent
  radiusBtn: '12px', // --r-btn (rounded-rect, never pill)
  radiusCard: '14px', // --r-card
} as const;

// --font-sans. Webfonts are unreliable in mail (Outlook and many Gmail configs
// drop them), so the email relies on the system fallbacks in this stack rather
// than Hanken Grotesk actually loading.
export const FONT_STACK =
  "'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

const catalogs = { en, fr, uk };

// The `email` namespace for a locale. Copy lives in i18n/locales/*.json (key
// parity enforced by i18n:check); these keys read server-side, outside the
// client-only vue-i18n runtime.
export const emailCopy = (locale: LandingLocale) => catalogs[locale].email;

export const interpolate = (
  template: string,
  params: Record<string, string>,
): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => params[key] ?? match);

// Escape a value before it lands in an HTML text or double-quoted attribute
// context. renderEmailDocument runs it over every dynamic insertion it makes
// (title, preview, footer, logo URL, lang), so the shell is safe-by-default even
// if a future email pipes user-controlled data through it. bodyHtml is the one
// exception — see its field doc. `&` first so introduced entities aren't re-escaped.
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface EmailDocument {
  locale: LandingLocale;
  title: string;
  previewText: string;
  // Trusted, pre-composed HTML markup — the ONE escape hatch. The caller owns
  // its safety and MUST escapeHtml() any dynamic/user data it interpolates.
  bodyHtml: string;
  footerTagline: string;
  logoUrl: string;
}

export const renderEmailDocument = (doc: EmailDocument): string =>
  `<!doctype html>
<html lang="${escapeHtml(doc.locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(doc.title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_BRAND.paper};font-family:${FONT_STACK};color:${EMAIL_BRAND.ink};">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(doc.previewText)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BRAND.paper};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="${escapeHtml(doc.logoUrl)}" width="48" height="48" alt="Vocabu" style="display:block;border-radius:${EMAIL_BRAND.radiusBtn};" />
              </td>
            </tr>
            <tr>
              <td style="background-color:${EMAIL_BRAND.surface};border:1px solid ${EMAIL_BRAND.hairline};border-radius:${EMAIL_BRAND.radiusCard};padding:32px 28px;">
                ${doc.bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 8px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">
                Vocabu · ${escapeHtml(doc.footerTagline)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
