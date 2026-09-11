import { describe, expect, mock, test } from 'bun:test';
import { leaveToFeed } from '../../utils/leave-to-feed';

const routerBehind = (back: unknown) => ({
  back: mock(() => {}),
  options: { history: { state: { back } } },
});

describe('leaveToFeed', () => {
  test('goes back when our own route is behind this one', async () => {
    const router = routerBehind('/feed');
    const navigate = mock(() => Promise.resolve());

    await leaveToFeed(router, navigate);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('replaces to the feed when nothing is behind', async () => {
    const router = routerBehind(null);
    const navigate = mock(() => Promise.resolve());

    await leaveToFeed(router, navigate);

    expect(router.back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/feed', { replace: true });
  });

  test('a missing back entry is the same as none', async () => {
    const router = routerBehind(undefined);
    const navigate = mock(() => Promise.resolve());

    await leaveToFeed(router, navigate);

    expect(router.back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/feed', { replace: true });
  });

  test('a rejected navigation reaches the caller', async () => {
    const router = routerBehind(null);
    const failure = new Error('chunk failed');
    const navigate = mock(() => Promise.reject(failure));

    await expect(leaveToFeed(router, navigate)).rejects.toBe(failure);
  });
});
