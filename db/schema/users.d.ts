import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users } from './users.js';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
