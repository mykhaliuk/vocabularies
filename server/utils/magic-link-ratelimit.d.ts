export interface MagicLinkRatelimitVerdict {
  allowed: boolean;
  reset: number;
}

export declare const checkMagicLinkRateLimits: (
  email: string,
  ip: string,
) => Promise<MagicLinkRatelimitVerdict>;
