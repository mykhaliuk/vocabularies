export interface CheckResult {
  status: string;
  message?: string;
}

export declare const runCheck: (
  label: string,
  fn: () => Promise<string>,
) => Promise<CheckResult>;

export declare const sanitize: (
  result: CheckResult,
  includeMessage: boolean,
) => CheckResult;
