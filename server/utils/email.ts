import { Resend } from 'resend';
import { renderMagicLinkEmail } from '~/server/utils/emails/magic-link';
import type { LandingLocale } from '~/shared/landing-locales';

export interface MagicLinkOptions {
  locale: LandingLocale;
  expiryMinutes: number;
}

export interface Emailer {
  isNull: boolean;
  sendMagicLink: (
    to: string,
    link: string,
    options: MagicLinkOptions,
  ) => Promise<void>;
}

const consoleEmailer: Emailer = {
  isNull: true,
  sendMagicLink: async (to, link, options) => {
    console.log(
      `[email:console] magic-link to=${to} locale=${options.locale} link=${link}`,
    );
  },
};

let cached: Emailer | null = null;

const create = (): Emailer => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const stage = process.env.APP_ENV ?? 'local';

  if (!apiKey || !from) {
    if (stage !== 'local') {
      throw new Error(
        `[email] RESEND_API_KEY and EMAIL_FROM are required when APP_ENV=${stage}`,
      );
    }
    console.log('[email] driver=console (local only)');
    return consoleEmailer;
  }

  const resend = new Resend(apiKey);
  console.log(`[email] driver=resend from=${from}`);
  return {
    isNull: false,
    sendMagicLink: async (to, link, options) => {
      const { subject, html, text } = renderMagicLinkEmail({
        locale: options.locale,
        link,
        expiryMinutes: options.expiryMinutes,
      });
      await resend.emails.send({ from, to, subject, html, text });
    },
  };
};

export const useEmail = () => {
  if (!cached) cached = create();
  return cached;
};
