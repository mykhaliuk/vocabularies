import { nanoid } from 'nanoid';

export type AvatarContentType = 'image/png' | 'image/jpeg';
export type AvatarExtension = 'png' | 'jpg';

const EXTENSION_BY_TYPE: ReadonlyMap<AvatarContentType, AvatarExtension> =
  new Map([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
  ]);

export const ALLOWED_CONTENT_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
] as const);

const PREFIX = 'avatars/';
const MAX_KEY_LENGTH = 512;

const buildPrefix = (userId: string) => `${PREFIX}${userId}/`;

export const contentTypeFromKey = (key: string) => {
  const dot = key.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = key.slice(dot + 1);
  for (const [type, extension] of EXTENSION_BY_TYPE) {
    if (extension === ext) return type;
  }
  return null;
};

export const mintAvatarKey = (
  userId: string,
  contentType: AvatarContentType,
) => {
  const ext = EXTENSION_BY_TYPE.get(contentType);
  if (!ext) {
    throw new Error(`[avatar-key] unsupported contentType: ${contentType}`);
  }
  return `${buildPrefix(userId)}${nanoid()}.${ext}`;
};

// Validates that `raw` is a well-formed avatar key owned by `userId`.
// Throws a plain Error on failure; callers translate to HTTP errors.
export const parseAvatarKey = (raw: unknown, userId: string) => {
  if (typeof raw !== 'string') throw new Error('[avatar-key] not a string');
  if (raw.length === 0 || raw.length > MAX_KEY_LENGTH) {
    throw new Error('[avatar-key] length out of range');
  }
  const prefix = buildPrefix(userId);
  if (!raw.startsWith(prefix)) {
    throw new Error('[avatar-key] prefix mismatch');
  }
  if (contentTypeFromKey(raw) === null) {
    throw new Error('[avatar-key] disallowed extension');
  }
  return raw;
};
