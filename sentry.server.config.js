import * as Sentry from '@sentry/nuxt';
import { beforeSend } from '~/shared/sentry-scrub';

const dsn = process.env.SENTRY_DSN ?? '';
const environment = process.env.APP_ENV ?? 'local';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    beforeSend,
  });
} else if (environment !== 'local') {
  console.error(
    `[sentry] SENTRY_DSN missing in ${environment}; error reporting disabled`,
  );
}
