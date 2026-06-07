export interface RatelimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export interface RatelimitLike {
  limit: (key: string) => Promise<RatelimitResult>;
}

export declare const useEmailRatelimit: () => RatelimitLike;
export declare const useIpRatelimit: () => RatelimitLike;
export declare const useCallbackIpRatelimit: () => RatelimitLike;
