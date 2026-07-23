import { z } from 'zod';
import { deleteOwnEntry } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { toHttpError } from '~/server/utils/http-errors';

const Params = z.object({ id: z.string().uuid() });

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { id } = await getValidatedRouterParams(event, (data) =>
    Params.parse(data),
  );

  try {
    await deleteOwnEntry(user.id, id);
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseStatus(event, 204);
  return null;
});
