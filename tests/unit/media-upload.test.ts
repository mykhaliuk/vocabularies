import { beforeEach, describe, expect, test } from 'bun:test';
import { ref } from 'vue';
import {
  useMediaUpload,
  type ComposeInput,
} from '../../composables/useMediaUpload';

// The composable reads `ref`, `$fetch` and `XMLHttpRequest` off the global
// scope (Nuxt auto-imports plus the browser), so the harness installs them
// before any test constructs it.

interface RecordedCall {
  method: string;
  url: string;
  body: unknown;
  credentials: unknown;
}

const UPLOAD_URL = 'https://storage.example/put/abc';
const ENTRY_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const OTHER_ENTRY_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const SLOT = {
  uploadUrl: UPLOAD_URL,
  key: 'originals/abc',
  mediaId: 'media-1',
  maxBytes: 1000,
};
const OTHER_SLOT = {
  ...SLOT,
  uploadUrl: `${UPLOAD_URL}-2`,
  key: 'originals/2',
};

const requests: RecordedCall[] = [];
const failing = new Set<string>();
const phaseTrail: string[] = [];
let watched: { value: string } | null = null;
let contentTypeSent = '';
let uploadStatus = 200;

const sequence = () => requests.map((call) => `${call.method} ${call.url}`);
const callTo = (url: string) => requests.find((call) => call.url === url);
const bodyOf = (url: string) => callTo(url)?.body;

// Sampled as each request goes out, so the phase ORDER is asserted rather
// than just the final value.
const samplePhase = () => {
  const current = watched?.value ?? '';
  if (current !== phaseTrail[phaseTrail.length - 1]) phaseTrail.push(current);
};

const fakeFetch = async (url: string, options: Record<string, unknown>) => {
  const method = String(options.method ?? 'GET');
  samplePhase();
  requests.push({
    method,
    url,
    body: options.body,
    credentials: options.credentials,
  });
  if (failing.has(url)) throw new Error(`refused ${url}`);
  if (url === '/api/entries') {
    const body = options.body as { media?: unknown };
    return { entry: { id: ENTRY_ID }, upload: body.media ? SLOT : null };
  }
  if (url === `/api/entries/${OTHER_ENTRY_ID}/media`) {
    return { upload: OTHER_SLOT };
  }
  if (url.endsWith('/media')) return { upload: SLOT };
  return {};
};

class FakeXhr {
  status = 0;
  upload = {
    addEventListener: (name: string, handler: (event: unknown) => void) => {
      if (name === 'progress') this.onProgress = handler;
    },
  };
  private onProgress: ((event: unknown) => void) | null = null;
  private listeners = new Map<string, () => void>();
  private call: RecordedCall = {
    method: '',
    url: '',
    body: null,
    credentials: null,
  };

  open(method: string, url: string) {
    this.call.method = method;
    this.call.url = url;
  }
  setRequestHeader(name: string, value: string) {
    if (name === 'Content-Type') contentTypeSent = value;
  }
  addEventListener(name: string, handler: () => void) {
    this.listeners.set(name, handler);
  }
  send(body: unknown) {
    this.call.body = body;
    samplePhase();
    requests.push(this.call);
    this.status = uploadStatus;
    const failed = failing.has(this.call.url);
    queueMicrotask(() => {
      if (!failed) {
        this.onProgress?.({ lengthComputable: true, loaded: 5, total: 10 });
      }
      this.listeners.get(failed ? 'error' : 'load')?.();
    });
  }
  abort() {
    queueMicrotask(() => this.listeners.get('abort')?.());
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
globals.ref = ref;
globals.$fetch = fakeFetch;
globals.XMLHttpRequest = FakeXhr;

const audioFile = () =>
  new File(['0123456789'], 'clip.webm', { type: 'audio/webm' });

const composeInput = (overrides: Partial<ComposeInput> = {}): ComposeInput => ({
  word: 'bapple',
  gloss: 'apple',
  sid: undefined,
  story: 'said at breakfast',
  file: null,
  ...overrides,
});

beforeEach(() => {
  requests.length = 0;
  phaseTrail.length = 0;
  failing.clear();
  watched = null;
  uploadStatus = 200;
  contentTypeSent = '';
});

describe('create path', () => {
  test('creates the entry, PUTs the file, then confirms the key', async () => {
    const upload = useMediaUpload();
    watched = upload.phase;
    const file = audioFile();

    const result = await upload.submit(composeInput({ file }), {
      entryId: undefined,
    });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      'POST /api/entries',
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
    expect(bodyOf('/api/entries')).toStrictEqual({
      word: 'bapple',
      gloss: 'apple',
      sid: undefined,
      story: 'said at breakfast',
      media: { contentType: 'audio/webm', sizeBytes: file.size },
    });
    expect(contentTypeSent).toBe('audio/webm');
    expect(bodyOf('/api/media/confirm')).toStrictEqual({ key: SLOT.key });
    expect(upload.phase.value).toBe('done');
  });

  test('walks creating -> uploading -> finalizing -> done', async () => {
    const upload = useMediaUpload();
    watched = upload.phase;

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    expect(phaseTrail).toEqual(['creating', 'uploading', 'finalizing']);
    expect(upload.phase.value).toBe('done');
  });

  test('sends the session cookie on every API call', async () => {
    const upload = useMediaUpload();

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    expect(callTo('/api/entries')?.credentials).toBe('include');
    expect(callTo('/api/media/confirm')?.credentials).toBe('include');
  });

  test('reports progress from the upload events', async () => {
    const upload = useMediaUpload();

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    expect(upload.progress.value).toBe(50);
  });

  test('trims the text fields and drops the blank ones', async () => {
    const upload = useMediaUpload();

    await upload.submit(
      composeInput({ word: '  bapple  ', gloss: '   ', story: '  ' }),
      { entryId: undefined },
    );

    expect(bodyOf('/api/entries')).toStrictEqual({
      word: 'bapple',
      gloss: undefined,
      sid: undefined,
      story: undefined,
      media: undefined,
    });
  });

  test('passes the chosen speaker through as sid', async () => {
    const upload = useMediaUpload();

    await upload.submit(composeInput({ sid: OTHER_ENTRY_ID }), {
      entryId: undefined,
    });

    expect(bodyOf('/api/entries')).toStrictEqual({
      word: 'bapple',
      gloss: 'apple',
      sid: OTHER_ENTRY_ID,
      story: 'said at breakfast',
      media: undefined,
    });
  });

  test('surfaces a failed upload without confirming', async () => {
    const upload = useMediaUpload();
    failing.add(UPLOAD_URL);

    const result = await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    expect(result).toBeNull();
    expect(upload.phase.value).toBe('error');
    expect(upload.errorMessage.value).toBe('The upload did not finish.');
    expect(sequence()).not.toContain('POST /api/media/confirm');
  });

  test('creates the entry alone when no file is attached', async () => {
    const upload = useMediaUpload();

    const result = await upload.submit(composeInput(), { entryId: undefined });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual(['POST /api/entries']);
  });

  test('reports a failed create and posts nothing further', async () => {
    const upload = useMediaUpload();
    failing.add('/api/entries');

    const result = await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    expect(result).toBeNull();
    expect(upload.phase.value).toBe('error');
    expect(upload.errorMessage.value).toBe('Could not save this word.');
    expect(sequence()).toEqual(['POST /api/entries']);
  });

  test('retrying after a failed confirm reuses the entry and slot', async () => {
    const upload = useMediaUpload();
    const input = composeInput({ file: audioFile() });
    failing.add('/api/media/confirm');

    expect(await upload.submit(input, { entryId: undefined })).toBeNull();
    expect(upload.phase.value).toBe('error');

    failing.clear();
    requests.length = 0;
    const retry = await upload.submit(input, { entryId: undefined });

    expect(retry).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('retrying after a failed upload reuses the entry and slot', async () => {
    const upload = useMediaUpload();
    const input = composeInput({ file: audioFile() });
    failing.add(UPLOAD_URL);

    expect(await upload.submit(input, { entryId: undefined })).toBeNull();

    failing.clear();
    requests.length = 0;
    const retry = await upload.submit(input, { entryId: undefined });

    expect(retry).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('swap() attaches the next file to the word already created', async () => {
    const upload = useMediaUpload();
    failing.add(UPLOAD_URL);

    expect(
      await upload.submit(composeInput({ file: audioFile() }), {
        entryId: undefined,
      }),
    ).toBeNull();

    failing.clear();
    requests.length = 0;
    upload.swap();
    const result = await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `POST /api/entries/${ENTRY_ID}/media`,
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('swap() then keeping without a file adds no second word', async () => {
    const upload = useMediaUpload();
    failing.add(UPLOAD_URL);

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });

    failing.clear();
    requests.length = 0;
    upload.swap();
    const result = await upload.submit(composeInput(), { entryId: undefined });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([]);
    expect(upload.phase.value).toBe('done');
  });

  test('swap() clears the failure the panel is showing', async () => {
    const upload = useMediaUpload();
    failing.add(UPLOAD_URL);

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: undefined,
    });
    expect(upload.phase.value).toBe('error');

    upload.swap();

    expect(upload.phase.value).toBe('idle');
    expect(upload.errorMessage.value).toBeUndefined();
    expect(upload.progress.value).toBe(0);
  });

  test('reset() lets the next submit create a second entry', async () => {
    const upload = useMediaUpload();
    const input = composeInput({ file: audioFile() });

    await upload.submit(input, { entryId: undefined });
    upload.reset();
    requests.length = 0;
    await upload.submit(input, { entryId: undefined });

    expect(sequence()).toEqual([
      'POST /api/entries',
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });
});

describe('attach path', () => {
  const attachUrl = `/api/entries/${ENTRY_ID}/media`;

  test('attaches to the entry, then PUTs and confirms as usual', async () => {
    const upload = useMediaUpload();
    const file = audioFile();

    const result = await upload.submit(composeInput({ file }), {
      entryId: ENTRY_ID,
    });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `POST ${attachUrl}`,
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
    expect(bodyOf(attachUrl)).toEqual({
      contentType: 'audio/webm',
      sizeBytes: file.size,
    });
    expect(bodyOf('/api/media/confirm')).toEqual({ key: SLOT.key });
  });

  test('never posts the word fields to the attach route', async () => {
    const upload = useMediaUpload();

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: ENTRY_ID,
    });

    expect(bodyOf(attachUrl)).not.toHaveProperty('word');
    expect(sequence()).not.toContain('POST /api/entries');
  });

  test('requests nothing when there is no file to attach', async () => {
    const upload = useMediaUpload();

    const result = await upload.submit(composeInput(), { entryId: ENTRY_ID });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([]);
  });

  test('a file attached after a no-file submit still reaches the server', async () => {
    const upload = useMediaUpload();

    await upload.submit(composeInput(), { entryId: ENTRY_ID });
    const result = await upload.submit(composeInput({ file: audioFile() }), {
      entryId: ENTRY_ID,
    });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `POST ${attachUrl}`,
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('a create after a failed attach never resumes the entry slot', async () => {
    const upload = useMediaUpload();
    const input = composeInput({ file: audioFile() });
    failing.add('/api/media/confirm');

    expect(await upload.submit(input, { entryId: OTHER_ENTRY_ID })).toBeNull();

    failing.clear();
    requests.length = 0;
    const result = await upload.submit(input, { entryId: undefined });

    expect(result).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      'POST /api/entries',
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
    expect(bodyOf('/api/media/confirm')).toStrictEqual({ key: SLOT.key });
  });

  test('a new target never resumes the previous entry slot', async () => {
    const upload = useMediaUpload();
    const input = composeInput({ file: audioFile() });
    failing.add('/api/media/confirm');

    expect(await upload.submit(input, { entryId: ENTRY_ID })).toBeNull();

    failing.clear();
    requests.length = 0;
    const result = await upload.submit(input, { entryId: OTHER_ENTRY_ID });

    expect(result).toEqual({ entryId: OTHER_ENTRY_ID });
    expect(sequence()).toEqual([
      `POST /api/entries/${OTHER_ENTRY_ID}/media`,
      `PUT ${OTHER_SLOT.uploadUrl}`,
      'POST /api/media/confirm',
    ]);
    expect(bodyOf('/api/media/confirm')).toStrictEqual({
      key: OTHER_SLOT.key,
    });
  });

  test('retrying after a failed confirm mints no second slot', async () => {
    const upload = useMediaUpload();
    const input = composeInput({ file: audioFile() });
    failing.add('/api/media/confirm');

    expect(await upload.submit(input, { entryId: ENTRY_ID })).toBeNull();

    failing.clear();
    requests.length = 0;
    const retry = await upload.submit(input, { entryId: ENTRY_ID });

    expect(retry).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('reports a failed attach with its own message', async () => {
    const upload = useMediaUpload();
    failing.add(attachUrl);

    const result = await upload.submit(composeInput({ file: audioFile() }), {
      entryId: ENTRY_ID,
    });

    expect(result).toBeNull();
    expect(upload.phase.value).toBe('error');
    expect(upload.errorMessage.value).toBe('Could not attach this media.');
  });
});
