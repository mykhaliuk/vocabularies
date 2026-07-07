import type { H3Event } from 'h3';

export const noStoreRedirect = (event: H3Event, location: string) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return sendRedirect(event, location, 302);
};
