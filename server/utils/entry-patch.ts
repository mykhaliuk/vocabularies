import { z } from 'zod';
// Relative, not the `~` alias: this module is imported directly by
// tests/unit (bun test, no Nuxt alias resolution), same reason
// server/utils/entitlements.ts keeps its runtime imports relative.
import { isValidIsoDate } from '../../shared/speaker-age';

// PATCH /api/entries/:id body (VKB-100, entry-actions-spec §"Edit: what
// moves, what holds"). Every field is optional and untouched when absent —
// a partial update, not a full replace. `sid` alone accepts an explicit
// `null`: that is a real instruction ("detach the speaker, fall back to
// You"), distinct from being absent ("leave the current speaker"). `gloss`/
// `story` also accept `null` as an explicit clear (same as an empty string —
// the route folds both to the same `null` before calling the domain).
// `.strict()` refuses any other key — `collection` (arrives with M19's
// entity migration), `id`, `createdAt`, `media` (untouched per spec)
// included.
//
// Compares against tomorrow's UTC date, not today's: a plain calendar date
// carries no timezone, and a caller east of UTC (up to UTC+14) can have a
// local "today" that is already tomorrow in UTC. One day of slack keeps the
// check a sanity gate against real future dates without rejecting a caller's
// own today.
const notInFuture = (value: string) => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return value <= tomorrow.toISOString().slice(0, 10);
};

export const EntryPatchBody = z
  .object({
    word: z.string().trim().min(1).max(200).optional(),
    gloss: z.string().trim().max(500).nullable().optional(),
    story: z.string().trim().max(5000).nullable().optional(),
    // The frozen-age anchor (entry-view.ts) — a future date would predate a
    // memory that has not happened yet, so it is refused here, not deep in
    // the domain layer.
    saidAt: z
      .string()
      .refine(isValidIsoDate, 'invalid date')
      .refine(notInFuture, 'date cannot be in the future')
      .optional(),
    sid: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    'at least one field is required',
  );

export type EntryPatchInput = z.infer<typeof EntryPatchBody>;
