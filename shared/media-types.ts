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

// Extension → MIME for pickers that hand over a file with an empty or alien
// type (iOS Files does, routinely). Where one extension serves two types the
// FIRST roster listing wins (.m4a → audio/mp4, .3gp → audio/3gpp).
export const TYPE_BY_EXTENSION: Readonly<Record<string, MediaContentType>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(EXTENSION_BY_TYPE)
        .reverse()
        .map(([type, extension]) => [extension, type]),
    ),
  ) as Record<string, MediaContentType>;

// iOS resolves accept extensions to UTIs far more reliably than MIME
// wildcards, which grey out perfectly valid files in the Files picker —
// so the accept string always carries both forms.
const buildAccept = (prefixes: readonly string[]): string => {
  const wildcards = prefixes.map((prefix) => `${prefix}*`);
  const extensions = new Set<string>();
  for (const [type, extension] of Object.entries(EXTENSION_BY_TYPE)) {
    if (prefixes.some((prefix) => type.startsWith(prefix))) {
      extensions.add(`.${extension}`);
    }
  }
  return [...wildcards, ...extensions].join(',');
};

export const AUDIO_ACCEPT = buildAccept(['audio/']);
export const AUDIO_VIDEO_ACCEPT = buildAccept(['audio/', 'video/']);
