import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';

export declare const headBucket: () => Promise<void>;
export declare const headObject: (
  key: string,
) => Promise<HeadObjectCommandOutput>;
export declare const presignPut: (
  key: string,
  contentType: string,
  ttlSec?: number,
) => Promise<string>;
export declare const presignGet: (
  key: string,
  ttlSec?: number,
) => Promise<string>;

export declare const isNotFoundError: (error: unknown) => boolean;
