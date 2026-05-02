import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { sessions } from './sessions.js';

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
