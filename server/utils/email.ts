import { Resend } from 'resend';

export interface Emailer {
  isNull: boolean;
  sendMagicLink: (to: string, link: string) => Promise<void>;
}

const consoleEmailer: Emailer = {
  isNull: true,
  sendMagicLink: async (to, link) => {
    console.log(`[email:console] magic-link to=${to} link=${link}`);
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
    sendMagicLink: async (to, link) => {
      await resend.emails.send({
        from,
        to,
        subject: 'Your Vocabu sign-in link',
        text: `Click to sign in: ${link}\n\nThe link expires in 15 minutes.`,
      });
    },
  };
};

export const useEmail = () => {
  if (!cached) cached = create();
  return cached;
};
