// Renders the branded, localized magic-link email (VKB-55). Pure given its
// input: the caller resolves the locale (resolveRequestLocale) and the token
// lifetime, so this stays testable and the emailer only forwards the result to
// Resend. Returns an HTML body and a plain-text fallback (deliverability).
import { getAppUrl } from '~/server/utils/app-url';
import type { LandingLocale } from '~/shared/landing-locales';
import {
  EMAIL_BRAND,
  FONT_STACK,
  emailCopy,
  interpolate,
  renderEmailDocument,
} from './shell';

export interface MagicLinkEmailInput {
  locale: LandingLocale;
  link: string;
  expiryMinutes: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const renderMagicLinkEmail = (
  input: MagicLinkEmailInput,
): RenderedEmail => {
  const { locale, link, expiryMinutes } = input;
  const copy = emailCopy(locale);
  const message = copy.magicLink;
  const minutes = String(expiryMinutes);

  const subject = message.subject;
  const previewText = interpolate(message.preview, { minutes });
  const expiry = interpolate(message.expiry, { minutes });
  const logoUrl = `${getAppUrl()}/icon-192.png`;

  const bodyHtml = [
    `<h1 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:20px;font-weight:600;line-height:1.3;color:${EMAIL_BRAND.ink};">${message.heading}</h1>`,
    `<p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:${EMAIL_BRAND.ink};">${message.body}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${EMAIL_BRAND.action}" style="border-radius:${EMAIL_BRAND.radiusBtn};"><a href="${link}" style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:16px;font-weight:500;line-height:1;color:${EMAIL_BRAND.onAction};text-decoration:none;border-radius:${EMAIL_BRAND.radiusBtn};">${message.cta}</a></td></tr></table>`,
    `<p style="margin:24px 0 4px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${expiry}</p>`,
    `<p style="margin:16px 0 4px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${message.fallback}</p>`,
    `<p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:${EMAIL_BRAND.link};">${link}</a></p>`,
    `<hr style="border:none;border-top:1px solid ${EMAIL_BRAND.hairline};margin:24px 0 0;" />`,
    `<p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${message.ignore}</p>`,
  ].join('\n');

  const html = renderEmailDocument({
    locale,
    title: subject,
    previewText,
    bodyHtml,
    footerTagline: copy.footer.tagline,
    logoUrl,
  });

  const text = [
    message.heading,
    '',
    message.body,
    '',
    link,
    '',
    expiry,
    '',
    message.ignore,
  ].join('\n');

  return { subject, html, text };
};
