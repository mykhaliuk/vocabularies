export const noStoreRedirect = (event, location) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return sendRedirect(event, location, 302);
};
