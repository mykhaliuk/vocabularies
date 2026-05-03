#!/usr/bin/env node
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? 'auto';
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET;
const appUrl = process.env.APP_URL;
const stage = process.env.APP_ENV;

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !appUrl) {
  console.error(
    '[r2-cors-set] missing one of S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, APP_URL',
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
const cors = {
  CORSRules: [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['Content-Type', 'x-amz-*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ],
};

const client = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: false,
});

console.log(
  `[r2-cors-set] stage=${stage} endpoint=${endpoint} bucket=${bucket}`,
);
console.log('[r2-cors-set] applying rules:');
console.log(JSON.stringify(cors.CORSRules[0], null, 2));

try {
  await client.send(
    new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: cors }),
  );
  const verify = await client.send(
    new GetBucketCorsCommand({ Bucket: bucket }),
  );
  console.log('[r2-cors-set] readback:');
  console.log(JSON.stringify(verify.CORSRules, null, 2));
  console.log('[r2-cors-set] done');
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[r2-cors-set] failed: ${message}`);
  process.exit(1);
}
