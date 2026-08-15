import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Two buckets per stage (ADR-0009):
// - media: derivatives + posters + avatars; the only bucket the app reads.
// - originals: private ingest for raw uploads; presigned PUT + transcoder
//   reads, never served to clients.
export type BucketKind = 'media' | 'originals';

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

const parseBool = (raw: unknown, key: string) => {
  if (raw == null || String(raw).trim() === '') {
    throw new Error(`[storage] ${key} is required`);
  }
  const value = String(raw).trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  throw new Error(
    `[storage] ${key} must be one of true|false|1|0|yes|no|on|off (got "${raw}")`,
  );
};

interface Storage {
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  mediaBucket: string;
  originalsBucket: string | undefined;
}

interface BucketAccess {
  client: S3Client;
  bucket: string;
}

let cached: Storage | null = null;

// One credential pair per bucket, so a leaked application key reaches only
// the bucket its job needs — the isolation ADR-0009 designs the two-bucket
// split for. The pairs never fall back to one another.
const CREDENTIAL_KEYS: Record<
  BucketKind,
  { accessKeyId: string; secretAccessKey: string }
> = {
  media: {
    accessKeyId: 'S3_MEDIA_ACCESS_KEY_ID',
    secretAccessKey: 'S3_MEDIA_SECRET_ACCESS_KEY',
  },
  originals: {
    accessKeyId: 'S3_ORIGINALS_ACCESS_KEY_ID',
    secretAccessKey: 'S3_ORIGINALS_SECRET_ACCESS_KEY',
  },
};

const clients = new Map<BucketKind, S3Client>();

const create = (): Storage => {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? 'auto';
  const mediaBucket = process.env.S3_BUCKET_MEDIA;
  const originalsBucket = process.env.S3_BUCKET_ORIGINALS || undefined;
  const forcePathStyle = parseBool(
    process.env.S3_FORCE_PATH_STYLE,
    'S3_FORCE_PATH_STYLE',
  );

  if (!endpoint) throw new Error('[storage] S3_ENDPOINT is required');
  if (!mediaBucket) {
    throw new Error('[storage] S3_BUCKET_MEDIA is required');
  }

  console.log(
    `[storage] endpoint=${endpoint} media=${mediaBucket} originals=${originalsBucket ?? '(unset)'} pathStyle=${forcePathStyle}`,
  );
  return { endpoint, region, forcePathStyle, mediaBucket, originalsBucket };
};

const useStorage = () => {
  if (!cached) cached = create();
  return cached;
};

const useClient = (kind: BucketKind) => {
  const existing = clients.get(kind);
  if (existing) return existing;

  const storage = useStorage();
  const keys = CREDENTIAL_KEYS[kind];
  const accessKeyId = process.env[keys.accessKeyId];
  const secretAccessKey = process.env[keys.secretAccessKey];

  if (!accessKeyId)
    throw new Error(`[storage] ${keys.accessKeyId} is required`);
  if (!secretAccessKey) {
    throw new Error(`[storage] ${keys.secretAccessKey} is required`);
  }

  const client = new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: storage.forcePathStyle,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  clients.set(kind, client);
  return client;
};

const resolve = (kind: BucketKind): BucketAccess => {
  const storage = useStorage();
  if (kind === 'media') {
    return { client: useClient('media'), bucket: storage.mediaBucket };
  }
  if (!storage.originalsBucket) {
    throw new Error('[storage] S3_BUCKET_ORIGINALS is required for originals');
  }
  return { client: useClient('originals'), bucket: storage.originalsBucket };
};

export const hasOriginalsBucket = () =>
  useStorage().originalsBucket !== undefined;

export const headBucket = async (kind: BucketKind = 'media') => {
  const { client, bucket } = resolve(kind);
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
};

export const headObject = async (key: string, kind: BucketKind = 'media') => {
  const { client, bucket } = resolve(kind);
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
};

export const getObject = async (key: string, kind: BucketKind = 'media') => {
  const { client, bucket } = resolve(kind);
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
};

export const putObject = async (
  key: string,
  body: Buffer,
  contentType: string,
  kind: BucketKind = 'media',
) => {
  const { client, bucket } = resolve(kind);
  return client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

// Streams a file from disk instead of buffering it — derivatives can be
// tens of MB and the lambda already holds the original plus PCM.
export const putFile = async (
  key: string,
  filePath: string,
  contentType: string,
  kind: BucketKind = 'media',
) => {
  const { size } = await stat(filePath);
  const { client, bucket } = resolve(kind);
  return client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
    }),
  );
};

export interface PresignPutOptions {
  kind?: BucketKind;
  ttlSec?: number;
  // When set, the signature covers Content-Length, so the client cannot
  // upload a bigger (or smaller) body than what was authorised.
  contentLength?: number;
}

export const presignPut = async (
  key: string,
  contentType: string,
  options: PresignPutOptions = {},
) => {
  const { kind = 'media', ttlSec = 300, contentLength } = options;
  const { client, bucket } = resolve(kind);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  // Force the signature to cover Content-Type (and Content-Length when
  // given) so a client cannot PUT with a different MIME or size than what
  // was authorised.
  const signableHeaders = new Set(['content-type']);
  if (contentLength !== undefined) signableHeaders.add('content-length');
  return getSignedUrl(client, command, {
    expiresIn: ttlSec,
    signableHeaders,
  });
};

export const presignGet = async (
  key: string,
  ttlSec = 3600,
  kind: BucketKind = 'media',
) => {
  const { client, bucket } = resolve(kind);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: ttlSec });
};

export const isNotFoundError = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;
  if ('name' in error && error.name === 'NotFound') return true;
  if ('$metadata' in error) {
    const meta = error.$metadata;
    if (meta && typeof meta === 'object' && 'httpStatusCode' in meta) {
      return meta.httpStatusCode === 404;
    }
  }
  return false;
};
