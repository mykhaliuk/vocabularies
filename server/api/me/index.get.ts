import { requireUser, toPublicUser } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return toPublicUser(user);
});
