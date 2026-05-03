import type { InferSelectModel } from 'drizzle-orm';
import type { H3Event } from 'h3';
import type { sessions } from '~/db/schema/sessions.js';
import type { users } from '~/db/schema/users.js';

type User = InferSelectModel<typeof users>;
type Session = InferSelectModel<typeof sessions>;

export interface PublicUser {
  email: string;
  displayName: string | null;
  hasAvatar: boolean;
}

export declare const normalizeEmail: (raw: string) => string;

export declare const generateRawToken: () => string;
export declare const hashToken: (raw: string) => Buffer;
export declare const safeEqualHashes: (a: Buffer, b: Buffer) => boolean;

export declare const signSession: (sessionId: Session['id']) => Promise<string>;
export declare const verifySession: (jwt: string) => Promise<Session['id']>;

export declare const setSessionCookie: (event: H3Event, jwt: string) => void;
export declare const clearSessionCookie: (event: H3Event) => void;

export declare const requireUser: (
  event: H3Event,
) => Promise<{ user: User; session: Session }>;

export declare const toPublicUser: (user: User) => PublicUser;

export declare const getSessionTtlMs: () => number;
export declare const getSessionCookieName: () => string;
