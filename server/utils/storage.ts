import {
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

let cached: { client: S3Client; bucket: string } | null = null;

const create = () => {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;
  const forcePathStyle = parseBool(
    process.env.S3_FORCE_PATH_STYLE,
    'S3_FORCE_PATH_STYLE',
  );

  if (!endpoint) throw new Error('[storage] S3_ENDPOINT is required');
  if (!accessKeyId) throw new Error('[storage] S3_ACCESS_KEY_ID is required');
  if (!secretAccessKey) {
    throw new Error('[storage] S3_SECRET_ACCESS_KEY is required');
  }
  if (!bucket) throw new Error('[storage] S3_BUCKET is required');

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  console.log(
    `[storage] endpoint=${endpoint} bucket=${bucket} pathStyle=${forcePathStyle}`,
  );
  return { client, bucket };
};

const useStorage = () => {
  if (!cached) cached = create();
  return cached;
};

export const headBucket = async () => {
  const { client, bucket } = useStorage();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
};

export const headObject = async (key: string) => {
  const { client, bucket } = useStorage();
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
};

export const presignPut = async (
  key: string,
  contentType: string,
  ttlSec = 300,
) => {
  const { client, bucket } = useStorage();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  // Force the signature to cover Content-Type so a client cannot PUT with a
  // different MIME than what was authorised.
  return getSignedUrl(client, command, {
    expiresIn: ttlSec,
    signableHeaders: new Set(['content-type']),
  });
};

export const presignGet = async (key: string, ttlSec = 3600) => {
  const { client, bucket } = useStorage();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: ttlSec });
};

export const isNotFoundError = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  if (e.name === 'NotFound') return true;
  if (e.$metadata && e.$metadata.httpStatusCode === 404) return true;
  return false;
};
