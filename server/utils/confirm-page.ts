// Renders the branded, localized confirmation-code page shown to the clicker
// in Safari (VKB-70). The magic link opens here; the clicker is already signed
// into THIS browser, and this page reveals the short code they must type on the
// device that started the sign-in (the PWA). The code is rendered in the page
// body only — never in a URL, a log, or any poll/confirm response — so an
// attacker holding the poll key, who never sees this page, cannot confirm.
//
// Like the transactional email (ADR-0007) this runs outside the client-only
// vue-i18n runtime, so copy is read straight from the locale catalogs and the
// design tokens are inlined as literals (ds:check never scans server/). The
// brand palette + font stack are reused from the email shell.
import en from '~/i18n/locales/en.json';
import fr from '~/i18n/locales/fr.json';
import uk from '~/i18n/locales/uk.json';
import type { LandingLocale } from '~/shared/landing-locales';
import {
  EMAIL_BRAND,
  FONT_STACK,
  escapeHtml,
  interpolate,
} from './emails/shell';

const catalogs = { en, fr, uk };

export interface ConfirmPageInput {
  locale: LandingLocale;
  code: string;
  expiryMinutes: number;
}

export const renderConfirmPage = (input: ConfirmPageInput): string => {
  const { locale, code, expiryMinutes } = input;
  const copy = catalogs[locale].auth.confirmPage;
  const minutes = String(expiryMinutes);

  const safe = {
    title: escapeHtml(copy.title),
    heading: escapeHtml(copy.heading),
    body: escapeHtml(copy.body),
    expiry: escapeHtml(interpolate(copy.expiry, { minutes })),
    continueLabel: escapeHtml(copy.continue),
    code: escapeHtml(code),
  };

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${safe.title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_BRAND.paper};font-family:${FONT_STACK};color:${EMAIL_BRAND.ink};">
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;">
      <div style="width:100%;max-width:400px;text-align:center;background-color:${EMAIL_BRAND.surface};border:1px solid ${EMAIL_BRAND.hairline};border-radius:${EMAIL_BRAND.radiusCard};padding:32px 28px;">
        <img src="/logo-mark.svg" width="48" height="48" alt="Vocabu" style="display:block;margin:0 auto 20px;border-radius:${EMAIL_BRAND.radiusBtn};" />
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;line-height:1.3;color:${EMAIL_BRAND.ink};">${safe.heading}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:${EMAIL_BRAND.ink};">${safe.body}</p>
        <div role="status" style="font-size:40px;font-weight:700;letter-spacing:0.3em;padding:16px 0 16px 12px;color:${EMAIL_BRAND.ink};background-color:${EMAIL_BRAND.paper};border-radius:${EMAIL_BRAND.radiusBtn};">${safe.code}</div>
        <p style="margin:20px 0 24px;font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${safe.expiry}</p>
        <a href="/me" style="display:inline-block;font-size:14px;font-weight:500;color:${EMAIL_BRAND.link};text-decoration:none;">${safe.continueLabel}</a>
      </div>
    </main>
  </body>
</html>`;
};
