import type { H3Event } from 'h3';

export declare const noStoreRedirect: (
  event: H3Event,
  location: string,
) => Promise<void>;
