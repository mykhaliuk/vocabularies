import * as Sentry from '@sentry/nuxt';

const EMAIL_REGEX = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const EMAIL_PLACEHOLDER = '<email>';
const MAX_DEPTH = 6;

const scrubString = (value) =>
  typeof value === 'string'
    ? value.replace(EMAIL_REGEX, EMAIL_PLACEHOLDER)
    : value;

// Walk an arbitrary value and rewrite every string leaf via scrubString. Depth
// limit prevents pathological deep recursion on cyclic / very nested objects.
const scrubValue = (value, depth = 0) => {
  if (depth >= MAX_DEPTH) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = scrubValue(value[i], depth + 1);
    }
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = scrubValue(value[key], depth + 1);
    }
    return value;
  }
  return value;
};

const dropSensitive = (event) => {
  if (event.request) {
    if (event.request.cookies) delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }
    if ('data' in event.request) delete event.request.data;
  }
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
};

const scrubEvent = (event) => {
  dropSensitive(event);

  if (event.message) event.message = scrubString(event.message);

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (value.value) value.value = scrubString(value.value);
    }
  }

  scrubValue(event.request, 0);
  scrubValue(event.contexts, 0);
  scrubValue(event.tags, 0);
  scrubValue(event.extra, 0);
  scrubValue(event.user, 0);
  scrubValue(event.breadcrumbs, 0);

  return event;
};

const safeScrub = (event) => {
  try {
    return scrubEvent(event);
  } catch (error) {
    console.error('[sentry] scrubEvent failed; dropping event', error);
    return null;
  }
};

const dsn = process.env.SENTRY_DSN ?? '';
const environment = process.env.APP_ENV ?? 'local';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    beforeSend: safeScrub,
  });
} else if (environment !== 'local') {
  console.error(
    `[sentry] SENTRY_DSN missing in ${environment}; error reporting disabled`,
  );
}
