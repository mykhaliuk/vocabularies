import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Two buckets per stage (ADR pending in VKB-63):
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
  client: S3Client;
  mediaBucket: string;
  originalsBucket: string | null;
}

let cached: Storage | null = null;

const create = (): Storage => {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  // S3_BUCKET_MEDIA is the canonical name; S3_BUCKET is the pre-two-bucket
  // fallback kept so deployed envs keep working until their vars migrate.
  const mediaBucket = process.env.S3_BUCKET_MEDIA || process.env.S3_BUCKET;
  const originalsBucket = process.env.S3_BUCKET_ORIGINALS || null;
  const forcePathStyle = parseBool(
    process.env.S3_FORCE_PATH_STYLE,
    'S3_FORCE_PATH_STYLE',
  );

  if (!endpoint) throw new Error('[storage] S3_ENDPOINT is required');
  if (!accessKeyId) throw new Error('[storage] S3_ACCESS_KEY_ID is required');
  if (!secretAccessKey) {
    throw new Error('[storage] S3_SECRET_ACCESS_KEY is required');
  }
  if (!mediaBucket) {
    throw new Error(
      '[storage] S3_BUCKET_MEDIA (or legacy S3_BUCKET) is required',
    );
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  console.log(
    `[storage] endpoint=${endpoint} media=${mediaBucket} originals=${originalsBucket ?? '(unset)'} pathStyle=${forcePathStyle}`,
  );
  return { client, mediaBucket, originalsBucket };
};

const useStorage = () => {
  if (!cached) cached = create();
  return cached;
};

const bucketName = (kind: BucketKind) => {
  const storage = useStorage();
  if (kind === 'media') return storage.mediaBucket;
  if (!storage.originalsBucket) {
    throw new Error('[storage] S3_BUCKET_ORIGINALS is required for originals');
  }
  return storage.originalsBucket;
};

export const hasOriginalsBucket = () => useStorage().originalsBucket !== null;

export const headBucket = async (kind: BucketKind = 'media') => {
  const { client } = useStorage();
  await client.send(new HeadBucketCommand({ Bucket: bucketName(kind) }));
};

export const headObject = async (key: string, kind: BucketKind = 'media') => {
  const { client } = useStorage();
  return client.send(
    new HeadObjectCommand({ Bucket: bucketName(kind), Key: key }),
  );
};

export const getObject = async (key: string, kind: BucketKind = 'media') => {
  const { client } = useStorage();
  return client.send(
    new GetObjectCommand({ Bucket: bucketName(kind), Key: key }),
  );
};

export const putObject = async (
  key: string,
  body: Buffer,
  contentType: string,
  kind: BucketKind = 'media',
) => {
  const { client } = useStorage();
  return client.send(
    new PutObjectCommand({
      Bucket: bucketName(kind),
      Key: key,
      Body: body,
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
  const { client } = useStorage();
  const command = new PutObjectCommand({
    Bucket: bucketName(kind),
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
  const { client } = useStorage();
  const command = new GetObjectCommand({ Bucket: bucketName(kind), Key: key });
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
