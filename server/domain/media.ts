import { and, eq, ne } from 'drizzle-orm';
import { media } from '~/db/schema/media';
import {
  derivedKeys,
  mintMediaId,
  mintOriginalKey,
  parseOriginalKey,
} from '~/server/utils/media-key';
import { MediaRejection, processMedia } from '~/server/utils/media-process';
import { enqueueMediaProcessing } from '~/server/utils/media-queue';
import { presignPut } from '~/server/utils/storage';
import { useDb } from '~/server/utils/db';
import { loadEntitlements } from './entitlements';
import { DOMAIN_ERROR_CODES, DomainError } from './errors';
import type { InferSelectModel } from 'drizzle-orm';
import type { AuthUser } from '~/server/utils/auth';
import type {
  MediaManifest,
  ProcessMediaOptions,
} from '~/server/utils/media-process';

export type MediaRow = InferSelectModel<typeof media>;

const UPLOAD_TTL_SEC = 600;

export interface UploadSlotInput {
  contentType: string;
  sizeBytes: number;
}

export interface UploadSlot {
  mediaId: string;
  key: string;
  uploadUrl: string;
  maxBytes: number;
}

export interface MintedSlot {
  slot: UploadSlot;
  row: MediaRow;
}

const kindOfContentType = (contentType: string): 'audio' | 'video' =>
  contentType.startsWith('video/') ? 'video' : 'audio';

// The single enforcement point for the videoUpload capability: every upload
// slot — entry-bound (POST /api/entries) or standalone (POST
// /api/media/upload) — is minted here, so the rest of the pipeline stays
// role-agnostic.
export const mintUploadSlot = async (
  user: AuthUser,
  input: UploadSlotInput,
  entryId: string | null,
): Promise<MintedSlot> => {
  const kind = kindOfContentType(input.contentType);
  if (kind === 'video' && !user.entitlements.videoUpload) {
    throw new DomainError(
      DOMAIN_ERROR_CODES.videoUploadForbidden,
      'video upload requires a premium plan',
    );
  }

  // Transport validates sizeBytes against the absolute ceiling, which is a
  // shape check; the plan's own cap is a business rule and belongs here. Today
  // every plan carries the ceiling, so this never fires — but slot.maxBytes is
  // reported FROM the plan, and reporting a cap the server would not accept is
  // exactly the contract drift that appears the day the numbers diverge.
  if (input.sizeBytes > user.entitlements.maxUploadBytes) {
    throw new DomainError(
      DOMAIN_ERROR_CODES.uploadTooLarge,
      `upload exceeds the ${user.entitlements.maxUploadBytes} byte limit`,
    );
  }

  const mediaId = mintMediaId();
  const key = mintOriginalKey(user.id, mediaId, input.contentType);
  // Presign before the insert: a signing failure then leaves no orphan row.
  let uploadUrl;
  try {
    uploadUrl = await presignPut(key, input.contentType, {
      kind: 'originals',
      ttlSec: UPLOAD_TTL_SEC,
      contentLength: input.sizeBytes,
    });
  } catch (error) {
    // Missing originals bucket / bad creds is an availability problem, not
    // a client error.
    console.error('[domain.media] presign failed', { key, error });
    throw new DomainError(
      DOMAIN_ERROR_CODES.storageUnavailable,
      'storage unavailable',
    );
  }

  const db = useDb();
  const [row] = await db
    .insert(media)
    .values({
      id: mediaId,
      entryId,
      ownerId: user.id,
      kind,
      originalKey: key,
    })
    .returning();
  if (!row) throw new Error('[domain.media] insert returned no row');

  return {
    slot: {
      mediaId,
      key,
      uploadUrl,
      maxBytes: user.entitlements.maxUploadBytes,
    },
    row,
  };
};

export const getOwnMedia = async (
  ownerId: string,
  mediaId: string,
): Promise<MediaRow> => {
  const db = useDb();
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    throw new DomainError(DOMAIN_ERROR_CODES.mediaNotFound, 'unknown media');
  }
  return row;
};

// Confirm = "the original is in the bucket, start processing". Transport
// has already verified the object (HeadObject) and the key shape; here the
// row is checked for ownership and the job is dispatched. Re-confirming an
// already-processed upload is a no-op — at-least-once friendly.
export const confirmMediaUpload = async (
  ownerId: string,
  mediaId: string,
  key: string,
): Promise<{ status: MediaRow['status']; transport: string | null }> => {
  const row = await getOwnMedia(ownerId, mediaId);
  if (row.status === 'ready' || row.status === 'failed') {
    return { status: row.status, transport: null };
  }
  const transport = await enqueueMediaProcessing(
    key,
    ownerId,
    processUploadedMedia,
  );
  return { status: 'processing', transport };
};

// Retries must never regress a ready row (failed→ready self-heals,
// ready→failed would be permanent) — mirrors the manifest no-clobber rule
// in media-process.ts.
const recordMediaReady = async (
  ownerId: string,
  mediaId: string,
  manifest: MediaManifest,
) => {
  const keys = derivedKeys(ownerId, mediaId);
  const db = useDb();
  const updated = await db
    .update(media)
    .set({
      status: 'ready',
      kind: manifest.kind,
      derivativeKey: manifest.kind === 'video' ? keys.video : keys.audio,
      posterKey: manifest.kind === 'video' ? keys.poster : null,
      durationSec: manifest.durationSec,
      width: manifest.width,
      height: manifest.height,
      peaks: manifest.peaks,
      error: null,
      updatedAt: new Date(),
    })
    .where(and(eq(media.id, mediaId), eq(media.ownerId, ownerId)))
    .returning({ id: media.id });
  if (updated.length === 0) {
    // Pre-schema spike uploads have manifests but no rows — the outcome is
    // still recorded in R2, so this is loud but not fatal.
    console.warn('[domain.media] ready outcome for unknown row', { mediaId });
  }
};

const recordMediaFailure = async (
  ownerId: string,
  mediaId: string,
  message: string,
) => {
  const db = useDb();
  await db
    .update(media)
    .set({ status: 'failed', error: message, updatedAt: new Date() })
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.ownerId, ownerId),
        ne(media.status, 'ready'),
      ),
    );
};

// The processing job as a domain operation: run the pipeline, then record
// the outcome on the media row. Called by the QStash worker route and, on
// local stages, directly as the inline fallback injected into the queue.
// Transient errors leave the row 'processing' and propagate so the caller
// retries; rejections are terminal and become 'failed'.
//
// `options.force` (VKB-81) passes straight through to processMedia's
// ready-manifest guard, unused today — the QStash worker route never reads
// it off the request body, since a redelivered/retried message must NOT be
// able to force a re-run — but it is the entry point a future deliberate
// reprocess (admin action, CLI) would call with `{ force: true }`.
export const processUploadedMedia = async (
  rawKey: string,
  userId: string,
  options: ProcessMediaOptions = {},
): Promise<MediaManifest> => {
  const { mediaId, key } = parseOriginalKey(rawKey, userId);
  try {
    const manifest = await processMedia(key, userId, options);
    // The slot-mint gate keys off the DECLARED content type; the probe
    // keys off the bytes. A video smuggled under an audio/* declaration
    // (mp4/m4a containers carry both) lands here as kind 'video' — re-check
    // the entitlement on the probed kind so the mint gate cannot be
    // bypassed. Runs on every delivery: an at-least-once redelivery must
    // not resurrect a row this check has failed.
    //
    // The owner load stays inside the branch: audio is the common path (a free
    // user cannot upload video at all), and hoisting it would spend a query
    // per audio upload on a result nothing reads.
    if (manifest.kind === 'video') {
      const owner = await loadEntitlements(userId);
      if (!owner.videoUpload) {
        throw new MediaRejection('video moments require a premium plan');
      }
    }
    await recordMediaReady(userId, mediaId, manifest);
    return manifest;
  } catch (error) {
    if (error instanceof MediaRejection) {
      await recordMediaFailure(userId, mediaId, error.message);
    }
    throw error;
  }
};
