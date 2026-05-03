export type AvatarContentType = 'image/png' | 'image/jpeg';
export type AvatarExtension = 'png' | 'jpg';

export declare const ALLOWED_CONTENT_TYPES: readonly [
  'image/png',
  'image/jpeg',
];

export declare const contentTypeFromKey: (
  key: string,
) => AvatarContentType | null;

export declare const mintAvatarKey: (
  userId: string,
  contentType: AvatarContentType,
) => string;

export declare const parseAvatarKey: (raw: unknown, userId: string) => string;
