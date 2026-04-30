export declare const headBucket: () => Promise<void>;
export declare const headObject: (key: string) => Promise<void>;
export declare const presignPut: (
  key: string,
  contentType: string,
  ttlSec?: number,
) => Promise<string>;
export declare const presignGet: (
  key: string,
  ttlSec?: number,
) => Promise<string>;
