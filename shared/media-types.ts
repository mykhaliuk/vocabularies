// The one roster of upload MIME types, shared by the server (media-key
// derives storage extensions and validation from it) and the compose picker
// (client-side pre-check). Two hand-synced copies is how the picker and the
// gate silently diverge — extend it HERE only.
//
// Anything a dictaphone or phone camera realistically produces. The
// original is stored as-is; ffmpeg decides later whether it can decode it.
// Several MIME types intentionally share one extension (audio/mp4 and
// audio/x-m4a are both .m4a) — extension identifies the container, the
// exact MIME the client declared lives on the stored object.
export const EXTENSION_BY_TYPE = Object.freeze({
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
  'audio/amr': 'amr',
  'audio/3gpp': '3gp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'video/x-matroska': 'mkv',
});

export type MediaContentType = keyof typeof EXTENSION_BY_TYPE;

export const ALLOWED_MEDIA_CONTENT_TYPES = Object.freeze(
  Object.keys(EXTENSION_BY_TYPE),
);
