export const runCheck = async (label, fn) => {
  try {
    return { status: await fn() };
  } catch (error) {
    console.error(`[health] ${label} failed:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', message };
  }
};

export const sanitize = (result, includeMessage) => {
  if (includeMessage) return result;
  return { status: result.status };
};
