import type { ErrorEvent, EventHint } from '@sentry/core';

export declare const safeScrub: (
  event: ErrorEvent,
  hint?: EventHint,
) => ErrorEvent | null;

export declare const beforeSend: (
  event: ErrorEvent,
  hint?: EventHint,
) => ErrorEvent | null;
