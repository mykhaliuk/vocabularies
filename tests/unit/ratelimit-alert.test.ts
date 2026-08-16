import { describe, expect, test } from 'bun:test';
import {
  createReportGate,
  isRatelimitConfigError,
  ratelimitConfigError,
} from '../../server/utils/ratelimit-alert';

const INTERVAL_MS = 5 * 60 * 1000;

describe('createReportGate', () => {
  test('lets the first report through', () => {
    const gate = createReportGate(INTERVAL_MS);
    expect(gate('media-upload', 1000)).toBe(true);
  });

  test('blocks repeats within the interval', () => {
    const gate = createReportGate(INTERVAL_MS);
    gate('media-upload', 1000);
    expect(gate('media-upload', 1000 + INTERVAL_MS - 1)).toBe(false);
  });

  test('lets a report through once the interval elapses', () => {
    const gate = createReportGate(INTERVAL_MS);
    gate('media-upload', 1000);
    expect(gate('media-upload', 1000 + INTERVAL_MS)).toBe(true);
  });

  test('throttles sources independently', () => {
    const gate = createReportGate(INTERVAL_MS);
    gate('media-upload', 1000);
    expect(gate('magic-link', 1001)).toBe(true);
    expect(gate('media-upload', 1002)).toBe(false);
  });

  test('a blocked attempt does not extend the window', () => {
    const gate = createReportGate(INTERVAL_MS);
    gate('probe', 1000);
    gate('probe', 1000 + INTERVAL_MS - 1);
    expect(gate('probe', 1000 + INTERVAL_MS)).toBe(true);
  });
});

describe('config-error classification', () => {
  test('a limiter that was never built is recognised', () => {
    expect(isRatelimitConfigError(ratelimitConfigError('production'))).toBe(
      true,
    );
  });

  test('the message names the stage that required a limiter', () => {
    expect(ratelimitConfigError('dev').message).toContain('APP_ENV=dev');
  });

  test('an Upstash outage is not a config error', () => {
    expect(isRatelimitConfigError(new Error('fetch failed'))).toBe(false);
  });

  test('a lookalike code on a non-Error is not a config error', () => {
    expect(isRatelimitConfigError({ code: 'ERATELIMIT_CONFIG' })).toBe(false);
  });

  test('undefined and null are not config errors', () => {
    expect(isRatelimitConfigError(undefined)).toBe(false);
    expect(isRatelimitConfigError(null)).toBe(false);
  });
});
