export interface CheckResult {
  status: string;
  message?: string;
}

export const runCheck = async (
  label: string,
  fn: () => Promise<string>,
): Promise<CheckResult> => {
  try {
    return { status: await fn() };
  } catch (error) {
    console.error(`[health] ${label} failed:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', message };
  }
};

export const sanitize = (result: CheckResult, includeMessage: boolean) => {
  if (includeMessage) return result;
  return { status: result.status };
};
