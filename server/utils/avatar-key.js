import { nanoid } from 'nanoid';

const EXTENSION_BY_TYPE = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
});

export const ALLOWED_CONTENT_TYPES = Object.freeze(['image/png', 'image/jpeg']);

const PREFIX = 'avatars/';
const MAX_KEY_LENGTH = 512;

const buildPrefix = (userId) => `${PREFIX}${userId}/`;

export const contentTypeFromKey = (key) => {
  const dot = key.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = key.slice(dot + 1);
  for (const [type, e] of Object.entries(EXTENSION_BY_TYPE)) {
    if (e === ext) return type;
  }
  return null;
};

export const mintAvatarKey = (userId, contentType) => {
  const ext = EXTENSION_BY_TYPE[contentType];
  if (!ext) {
    throw new Error(`[avatar-key] unsupported contentType: ${contentType}`);
  }
  return `${buildPrefix(userId)}${nanoid()}.${ext}`;
};

// Validates that `raw` is a well-formed avatar key owned by `userId`.
// Throws a plain Error on failure; callers translate to HTTP errors.
export const parseAvatarKey = (raw, userId) => {
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
