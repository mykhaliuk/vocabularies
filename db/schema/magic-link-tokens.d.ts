import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { magicLinkTokens } from './magic-link-tokens.js';

type RawSelect = InferSelectModel<typeof magicLinkTokens>;
type RawInsert = InferInsertModel<typeof magicLinkTokens>;

// `tokenHash` is a 32-byte SHA-256 digest stored as bytea. Drizzle's `customType`
// without generics infers the column as `unknown`; override here so consumers
// type it as Buffer.
export type MagicLinkToken = Omit<RawSelect, 'tokenHash'> & {
  tokenHash: Buffer;
};

export type NewMagicLinkToken = Omit<RawInsert, 'tokenHash'> & {
  tokenHash: Buffer;
};
