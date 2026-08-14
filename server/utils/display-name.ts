import { z } from 'zod';
// Relative, not the `~` alias: imported by tests/unit (bun test, no Nuxt
// alias resolution), same as server/utils/entry-patch.ts.
import { DISPLAY_NAME_MAX } from '../../shared/display-name';

// PATCH /api/me body (VKB-94). `trim()` runs before `min(1)`, so a
// whitespace-only name is rejected rather than stored verbatim.
export const DisplayNameBody = z.object({
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
});
