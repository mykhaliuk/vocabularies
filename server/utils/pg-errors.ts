// Recognising a Postgres driver error is infra knowledge, not domain
// knowledge: the domain decides what a violated invariant *means* and throws
// a DomainError for it, this file only says which violation was raised.

// `media(entry_id) WHERE entry_id IS NOT NULL` — the partial unique index
// that makes "one moment per entry" a database invariant (migration 0007).
const ENTRY_MOMENT_INDEX = 'media_entry_id_unique';
const UNIQUE_VIOLATION = '23505';

// Matched on the Postgres code and the constraint name, never on message
// text: a message is a locale- and version-dependent string, so matching it
// would turn a wording change upstream into a silently unhandled error.
export const isEntryMomentConflict = (error: unknown) =>
  error instanceof Error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION &&
  (error as { constraint?: string }).constraint === ENTRY_MOMENT_INDEX;
