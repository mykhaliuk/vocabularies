import { z } from 'zod';
// Relative, not the `~` alias: this module is imported directly by
// tests/unit (bun test, no Nuxt alias resolution), same reason
// server/utils/entitlements.ts keeps its runtime imports relative.
import { isValidIsoDate } from '../../shared/speaker-age';
import type { EntryPatch } from '../domain/entries';

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
// Compares against `tomorrow`'s UTC date, not today's: a plain calendar date
// carries no timezone, and a caller east of UTC (up to UTC+14) can have a
// local "today" that is already tomorrow in UTC. One day of slack keeps the
// check a sanity gate against real future dates without rejecting a caller's
// own today.
//
// `now` is an injected, defaulted parameter — not read from inside the
// function body — so a test can pin the timezone-slack boundary with
// literal dates on both sides. Computing "tomorrow" the same way in the
// test as in the implementation would only prove the two agree, and would
// keep agreeing under a regression to local-time math (`setDate`/`getDate`)
// on any runner where local time equals UTC, which is exactly GitHub
// Actions.
export const notInFuture = (value: string, now: Date = new Date()) => {
  const tomorrow = new Date(now);
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

// The absent-vs-null mapping onto the domain's EntryPatch shape (VKB-100
// review): this is where the partial-update contract actually lives — 'sid'
// in body distinguishes "detach the speaker" (null) from "leave it alone"
// (absent), and `|| null` folds an empty string and an explicit null to the
// same clear. Extracted as a pure, exported function (rather than left
// inline in the route) so a regression here — e.g. someone "simplifying"
// `if ('sid' in body) patch.sid = body.sid ?? null;` into
// `if (body.sid) patch.sid = body.sid;`, which silently stops clearing the
// speaker — fails a test instead of passing typecheck, lint, and every
// existing test untouched.
export const toEntryPatch = (body: EntryPatchInput): EntryPatch => {
  const patch: EntryPatch = {};
  if (body.word !== undefined) patch.word = body.word;
  if (body.gloss !== undefined) patch.gloss = body.gloss || null;
  if (body.story !== undefined) patch.story = body.story || null;
  if (body.saidAt !== undefined) patch.saidAt = body.saidAt;
  if ('sid' in body) patch.sid = body.sid ?? null;
  return patch;
};
