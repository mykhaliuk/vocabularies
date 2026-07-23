import { DOMAIN_ERROR_CODES, DomainError } from '~/server/domain/errors';

const STATUS_BY_CODE: Record<string, number> = {
  [DOMAIN_ERROR_CODES.videoUploadForbidden]: 403,
  [DOMAIN_ERROR_CODES.entryNotFound]: 404,
  [DOMAIN_ERROR_CODES.mediaNotFound]: 404,
  [DOMAIN_ERROR_CODES.storageUnavailable]: 503,
};

// Transport-side mapping of domain errors to HTTP. Unknown errors pass
// through untouched (Nitro turns them into a 500 without leaking details).
export const toHttpError = (error: unknown) => {
  if (!(error instanceof DomainError)) return error;
  return createError({
    statusCode: STATUS_BY_CODE[error.code] ?? 500,
    statusMessage: error.message,
    data: { code: error.code },
  });
};
