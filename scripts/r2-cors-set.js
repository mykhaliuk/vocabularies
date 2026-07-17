#!/usr/bin/env node
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Two buckets, two CORS profiles (VKB-63):
// - media: the app only ever GETs derivatives/posters/avatars from it.
// - originals: the browser only ever PUTs raw uploads into it.
// Content-Length is in AllowedHeaders because presigned PUTs sign it.

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? 'auto';
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const mediaBucket = process.env.S3_BUCKET_MEDIA ?? process.env.S3_BUCKET;
const originalsBucket = process.env.S3_BUCKET_ORIGINALS;
const appUrl = process.env.APP_URL;
const stage = process.env.APP_ENV;

if (!endpoint || !accessKeyId || !secretAccessKey || !mediaBucket || !appUrl) {
  console.error(
    '[r2-cors-set] missing one of S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_MEDIA, APP_URL',
  );
  process.exit(2);
}

if (!stage || stage === 'local') {
  console.error(
    '[r2-cors-set] refusing: APP_ENV must be a cloud stage (dev|preprod), got',
    stage ?? '<unset>',
  );
  process.exit(2);
}

const allowedOrigins = ['http://localhost:3000', appUrl];

const profiles = [
  {
    bucket: mediaBucket,
    rules: [
      {
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['Content-Type'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
      // Avatars still upload straight into the media bucket; drop this rule
      // once they move behind the originals-style flow (VKB-64).
      {
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ['PUT'],
        AllowedHeaders: ['Content-Type', 'x-amz-*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
  },
];

if (originalsBucket) {
  profiles.push({
    bucket: originalsBucket,
    rules: [
      {
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ['PUT'],
        AllowedHeaders: ['Content-Type', 'Content-Length', 'x-amz-*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
  });
} else {
  console.warn('[r2-cors-set] S3_BUCKET_ORIGINALS unset — skipping originals');
}

const client = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: false,
});

let failed = false;
for (const profile of profiles) {
  console.log(
    `[r2-cors-set] stage=${stage} endpoint=${endpoint} bucket=${profile.bucket}`,
  );
  console.log(JSON.stringify(profile.rules, null, 2));
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: profile.bucket,
        CORSConfiguration: { CORSRules: profile.rules },
      }),
    );
    const verify = await client.send(
      new GetBucketCorsCommand({ Bucket: profile.bucket }),
    );
    console.log('[r2-cors-set] readback:');
    console.log(JSON.stringify(verify.CORSRules, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[r2-cors-set] ${profile.bucket} failed: ${message}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('[r2-cors-set] done');
