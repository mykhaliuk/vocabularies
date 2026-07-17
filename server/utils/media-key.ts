import { nanoid } from 'nanoid';

// Spike-scope limits (VKB-63): a moment is <= 20s; 250MB covers 20s of
// 4K60 H.264 with headroom. Duration is enforced server-side after probe.
export const MAX_ORIGINAL_BYTES = 250 * 1024 * 1024;
export const MAX_DURATION_SEC = 20;
// Probe tolerance: containers often report 20.0x for a "20s" clip.
export const DURATION_TOLERANCE_SEC = 0.75;

export type MediaExtension = string;

// Anything a dictaphone or phone camera realistically produces. The
// original is stored as-is; ffmpeg decides later whether it can decode it.
const EXTENSION_BY_TYPE: ReadonlyMap<string, MediaExtension> = new Map([
  ['audio/mp4', 'm4a'],
  ['audio/x-m4a', 'm4a'],
  ['audio/aac', 'aac'],
  ['audio/mpeg', 'mp3'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav'],
  ['audio/webm', 'weba'],
  ['audio/amr', 'amr'],
  ['audio/3gpp', '3gp'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
  ['video/webm', 'webm'],
  ['video/3gpp', '3gp'],
  ['video/x-matroska', 'mkv'],
]);

export const ALLOWED_MEDIA_CONTENT_TYPES = Object.freeze([
  ...EXTENSION_BY_TYPE.keys(),
]);

const MAX_KEY_LENGTH = 512;
const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{10,32}$/;

export const isVideoContentType = (contentType: string) =>
  contentType.startsWith('video/');

export const mintMediaId = () => nanoid();

// Originals bucket layout: <userId>/<mediaId>/original.<ext>
export const mintOriginalKey = (
  userId: string,
  mediaId: string,
  contentType: string,
) => {
  const ext = EXTENSION_BY_TYPE.get(contentType);
  if (!ext) {
    throw new Error(`[media-key] unsupported contentType: ${contentType}`);
  }
  return `${userId}/${mediaId}/original.${ext}`;
};

export const contentTypeFromOriginalKey = (key: string) => {
  const dot = key.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = key.slice(dot + 1);
  for (const [type, extension] of EXTENSION_BY_TYPE) {
    if (extension === ext) return type;
  }
  return null;
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
  if (contentTypeFromOriginalKey(raw) === null) {
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
