import { nanoid } from 'nanoid';
import { EXTENSION_BY_TYPE } from '~/shared/media-types';
import type { MediaContentType } from '~/shared/media-types';

// Spike-scope limits (VKB-63): 250MB covers 20s of 4K60 H.264 with
// headroom. Duration limits differ by kind — video is capped tight (weight
// + transcode cost), audio is cheap in every dimension so long monologues
// are welcome. Enforced server-side after probe; the client pre-checks
// best-effort via loadedmetadata.
export const MAX_ORIGINAL_BYTES = 250 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SEC = 20;
export const MAX_AUDIO_DURATION_SEC = 180;
// Probe tolerance: containers often report 20.0x for a "20s" clip.
export const DURATION_TOLERANCE_SEC = 0.75;

// The type roster lives in shared/media-types.ts (the compose picker
// mirrors the same list); re-exported so the transport layer keeps one
// import site for upload validation.
export { ALLOWED_MEDIA_CONTENT_TYPES } from '~/shared/media-types';

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(
  Object.values(EXTENSION_BY_TYPE),
);

const MAX_KEY_LENGTH = 512;
export const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{10,32}$/;

export const mintMediaId = () => nanoid();

const extensionOfKey = (key: string) => {
  const dot = key.lastIndexOf('.');
  return dot === -1 ? null : key.slice(dot + 1);
};

// Originals bucket layout: <userId>/<mediaId>/original.<ext>
export const mintOriginalKey = (
  userId: string,
  mediaId: string,
  contentType: string,
) => {
  const ext = EXTENSION_BY_TYPE[contentType as MediaContentType];
  if (!ext) {
    throw new Error(`[media-key] unsupported contentType: ${contentType}`);
  }
  return `${userId}/${mediaId}/original.${ext}`;
};

// True when `contentType` is an allowed MIME whose extension matches the
// key's. Extensions are shared between MIMEs, so this is the correct
// check for confirm — an exact reverse lookup would reject audio/x-m4a
// uploads because .m4a maps first to audio/mp4.
export const contentTypeMatchesKey = (key: string, contentType: unknown) => {
  if (typeof contentType !== 'string') return false;
  const ext = EXTENSION_BY_TYPE[contentType as MediaContentType];
  return ext !== undefined && ext === extensionOfKey(key);
};

export interface ParsedOriginalKey {
  key: string;
  userId: string;
  mediaId: string;
}

// Validates that `raw` is a well-formed original key owned by `userId`.
// Throws a plain Error on failure; callers translate to HTTP errors.
export const parseOriginalKey = (
  raw: unknown,
  userId: string,
): ParsedOriginalKey => {
  if (typeof raw !== 'string') throw new Error('[media-key] not a string');
  if (raw.length === 0 || raw.length > MAX_KEY_LENGTH) {
    throw new Error('[media-key] length out of range');
  }
  const prefix = `${userId}/`;
  if (!raw.startsWith(prefix)) throw new Error('[media-key] prefix mismatch');
  const rest = raw.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash === -1) throw new Error('[media-key] missing media id segment');
  const mediaId = rest.slice(0, slash);
  if (!MEDIA_ID_PATTERN.test(mediaId)) {
    throw new Error('[media-key] malformed media id');
  }
  if (!rest.slice(slash + 1).startsWith('original.')) {
    throw new Error('[media-key] not an original key');
  }
  const ext = extensionOfKey(raw);
  if (ext === null || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('[media-key] disallowed extension');
  }
  return { key: raw, userId, mediaId };
};

// Media bucket layout (derivatives): media/<userId>/<mediaId>/<artifact>
const derivedPrefix = (userId: string, mediaId: string) =>
  `media/${userId}/${mediaId}/`;

export const derivedKeys = (userId: string, mediaId: string) => {
  const prefix = derivedPrefix(userId, mediaId);
  return {
    video: `${prefix}video.mp4`,
    audio: `${prefix}audio.m4a`,
    poster: `${prefix}poster.jpg`,
    manifest: `${prefix}manifest.json`,
  };
};
