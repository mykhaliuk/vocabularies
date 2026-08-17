// Structured business errors. Domain operations throw these with a stable
// code; transport maps codes to HTTP statuses and never leaks internals.
export class DomainError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export const DOMAIN_ERROR_CODES = Object.freeze({
  videoUploadForbidden: 'VIDEO_UPLOAD_FORBIDDEN',
  uploadTooLarge: 'UPLOAD_TOO_LARGE',
  entryNotFound: 'ENTRY_NOT_FOUND',
  speakerNotFound: 'SPEAKER_NOT_FOUND',
  mediaNotFound: 'MEDIA_NOT_FOUND',
  storageUnavailable: 'STORAGE_UNAVAILABLE',
  entryMomentConflict: 'ENTRY_MOMENT_CONFLICT',
});
