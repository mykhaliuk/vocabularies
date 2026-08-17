import { DOMAIN_ERROR_CODES, DomainError } from '~/server/domain/errors';

const STATUS_BY_CODE: Record<string, number> = {
  [DOMAIN_ERROR_CODES.videoUploadForbidden]: 403,
  [DOMAIN_ERROR_CODES.uploadTooLarge]: 413,
  [DOMAIN_ERROR_CODES.entryNotFound]: 404,
  [DOMAIN_ERROR_CODES.speakerNotFound]: 404,
  [DOMAIN_ERROR_CODES.mediaNotFound]: 404,
  [DOMAIN_ERROR_CODES.storageUnavailable]: 503,
  [DOMAIN_ERROR_CODES.entryMomentConflict]: 409,
};

// Transport-side mapping of domain errors to HTTP. Unknown errors pass
// through untouched (Nitro turns them into a 500 without leaking details);
// so does a DomainError whose code has no mapping — its message and code
// are exposed to clients ONLY when the code is explicitly mapped here.
export const toHttpError = (error: unknown) => {
  if (!(error instanceof DomainError)) return error;
  const statusCode = STATUS_BY_CODE[error.code];
  if (!statusCode) return error;
  return createError({
    statusCode,
    statusMessage: error.message,
    data: { code: error.code },
  });
};
