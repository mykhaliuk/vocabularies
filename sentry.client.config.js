import * as Sentry from '@sentry/nuxt';
import { beforeSend } from '~/server/utils/sentry-scrub.js';

const config = useRuntimeConfig();
const dsn = config.public.sentryDsn || '';
const environment = config.public.appEnv || 'local';

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
