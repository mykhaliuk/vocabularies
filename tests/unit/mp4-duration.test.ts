import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
  parseMvhdDurationSec,
  readMp4DurationSec,
} from '../../utils/mp4-duration';

// Container-level duration (VKB-67 follow-up): the guard that catches a
// too-long file whose codec the browser cannot decode (ALAC in .m4a).

const fourCC = (s: string) => [...s].map((c) => c.charCodeAt(0));

const box = (type: string, body: number[]): number[] => {
  const size = 8 + body.length;
  return [
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    ...fourCC(type),
    ...body,
  ];
};

const u32 = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];

const u64 = (n: number): number[] => [
  ...u32(Math.floor(n / 2 ** 32)),
  ...u32(n % 2 ** 32),
];

// mvhd v0: version+flags, creation, modification, timescale, duration.
const mvhdV0 = (timescale: number, duration: number) =>
  box('mvhd', [
    0,
    0,
    0,
    0,
    ...u32(0),
    ...u32(0),
    ...u32(timescale),
    ...u32(duration),
  ]);

const mvhdV1 = (timescale: number, duration: number) =>
  box('mvhd', [
    1,
    0,
    0,
    0,
    ...u64(0),
    ...u64(0),
    ...u32(timescale),
    ...u64(duration),
  ]);

const view = (bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);

describe('parseMvhdDurationSec', () => {
  test('reads a version-0 mvhd', () => {
    const moov = mvhdV0(1000, 514560);
    expect(parseMvhdDurationSec(view(moov))).toBeCloseTo(514.56, 2);
  });

  test('reads a version-1 mvhd behind a sibling box', () => {
    const moov = [...box('iods', [1, 2, 3]), ...mvhdV1(600, 6000)];
    expect(parseMvhdDurationSec(view(moov))).toBe(10);
  });

  test('an unknown duration (0xffffffff) proves nothing', () => {
    const moov = mvhdV0(1000, 0xffffffff);
    expect(parseMvhdDurationSec(view(moov))).toBeNull();
  });

  test('a zero timescale proves nothing', () => {
    const moov = mvhdV0(0, 1000);
    expect(parseMvhdDurationSec(view(moov))).toBeNull();
  });

  test('garbage bytes prove nothing', () => {
    expect(parseMvhdDurationSec(view([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBeNull();
  });
});

describe('readMp4DurationSec', () => {
  test('finds moov after other top-level boxes', async () => {
    const bytes = [
      ...box('ftyp', fourCC('M4A ')),
      ...box(
        'mdat',
        Array.from({ length: 64 }, () => 7),
      ),
      ...box('moov', mvhdV0(90000, 90000 * 42)),
    ];
    const file = new File([Uint8Array.from(bytes)], 'x.m4a');
    expect(await readMp4DurationSec(file)).toBe(42);
  });

  test('a file with no moov proves nothing', async () => {
    const file = new File([Uint8Array.from(box('mdat', [1, 2, 3]))], 'x.m4a');
    expect(await readMp4DurationSec(file)).toBeNull();
  });

  // The real thing: the ALAC voice file the browser cannot decode but the
  // container fully describes. Skipped when the local fixture is absent —
  // it is a 25MB binary that lives outside the repo.
  const FIXTURE = 'tests/assets/too-big-audio-file.m4a';
  test.skipIf(!existsSync(FIXTURE))(
    'reads the ALAC fixture the media element cannot',
    async () => {
      const file = new File([readFileSync(FIXTURE)], 'too-big.m4a');
      const duration = await readMp4DurationSec(file);
      expect(duration).not.toBeNull();
      expect(duration as number).toBeCloseTo(514.56, 1);
    },
  );
});
