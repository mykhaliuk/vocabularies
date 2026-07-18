// Renders the branded, localized magic-link email (VKB-55). Pure given its
// input: the caller resolves the locale (resolveRequestLocale) and the token
// lifetime, so this stays testable and the emailer only forwards the result to
// Resend. Returns an HTML body and a plain-text fallback (deliverability).
import type { LandingLocale } from '~/shared/landing-locales';
import {
  EMAIL_LOGO_BASE64,
  EMAIL_LOGO_CONTENT_ID,
  EMAIL_LOGO_FILENAME,
} from './logo';
import {
  EMAIL_BRAND,
  FONT_STACK,
  emailCopy,
  escapeHtml,
  interpolate,
  renderEmailDocument,
} from './shell';

export interface MagicLinkEmailInput {
  locale: LandingLocale;
  link: string;
  expiryMinutes: number;
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentId: string;
  contentType: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
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
  // The logo travels with the message as a CID attachment: mail image proxies
  // never fetch it over HTTP, so it cannot break on protected or stale origins
  // (VKB-69 — dev sits behind Vercel SSO and prod may run a release that does
  // not ship the asset yet).
  const logoUrl = `cid:${EMAIL_LOGO_CONTENT_ID}`;

  // bodyHtml is the shell's trusted-HTML hatch, so this renderer owns escaping.
  // The copy and link are repo/operator-controlled today, but escaping keeps the
  // markup valid if a translation ever contains &/</'" or the link gains query
  // params (& must be an entity in HTML). escapeHtml(link) is safe in both the
  // href attribute and the text node.
  const safe = {
    heading: escapeHtml(message.heading),
    body: escapeHtml(message.body),
    cta: escapeHtml(message.cta),
    expiry: escapeHtml(expiry),
    fallback: escapeHtml(message.fallback),
    ignore: escapeHtml(message.ignore),
    link: escapeHtml(link),
  };

  const bodyHtml = [
    `<h1 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:20px;font-weight:600;line-height:1.3;color:${EMAIL_BRAND.ink};">${safe.heading}</h1>`,
    `<p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:${EMAIL_BRAND.ink};">${safe.body}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${EMAIL_BRAND.action}" style="border-radius:${EMAIL_BRAND.radiusBtn};"><a href="${safe.link}" style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:16px;font-weight:500;line-height:1;color:${EMAIL_BRAND.onAction};text-decoration:none;border-radius:${EMAIL_BRAND.radiusBtn};">${safe.cta}</a></td></tr></table>`,
    `<p style="margin:24px 0 4px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${safe.expiry}</p>`,
    `<p style="margin:16px 0 4px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${safe.fallback}</p>`,
    `<p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safe.link}" style="color:${EMAIL_BRAND.link};">${safe.link}</a></p>`,
    `<hr style="border:none;border-top:1px solid ${EMAIL_BRAND.hairline};margin:24px 0 0;" />`,
    `<p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">${safe.ignore}</p>`,
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

  const attachments = [
    {
      filename: EMAIL_LOGO_FILENAME,
      content: EMAIL_LOGO_BASE64,
      contentId: EMAIL_LOGO_CONTENT_ID,
      contentType: 'image/png',
    },
  ];

  return { subject, html, text, attachments };
};
