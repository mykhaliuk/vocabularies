import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '~/db/schema/users';

// RBAC via capability→roles (VKB-64): a capability maps to the roles that
// receive it; a user's roles = their plan + their grants. The map lives in
// code, not a table — it only changes when a feature/plan ships, which is
// already a deploy. Recorded exit: when changing access without a deploy
// becomes a real need, this moves to a capability_roles table read inside
// can() — consumers untouched.
//
// One-door rule: nobody reads user.plan / user.grants outside this module
// (reviewable with a grep for \.plan|\.grants).

type UserRoles = Pick<InferSelectModel<typeof users>, 'plan' | 'grants'>;

export type Capability = 'videoUpload';

const CAPABILITY_ROLES: Record<Capability, readonly string[]> = Object.freeze({
  videoUpload: Object.freeze(['vip', 'admin', 'premium']),
});

const rolesOf = (user: UserRoles): string[] => [user.plan, ...user.grants];

export const can = (user: UserRoles, capability: Capability): boolean => {
  const allowed = CAPABILITY_ROLES[capability];
  if (!allowed) return false;
  const roles = rolesOf(user);
  return allowed.some((role) => roles.includes(role));
};
