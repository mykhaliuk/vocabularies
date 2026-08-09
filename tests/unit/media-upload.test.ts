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
// A PUT answered with a non-2xx status and an S3/R2 error body, as opposed to
// `failing`, which drops the connection before any answer arrives.
const refusals = new Map<string, { status: number; body: string }>();
const phaseTrail: string[] = [];
let watched: { value: string } | null = null;
let contentTypeSent = '';
let uploadStatus = 200;

// Parks a request mid-flight so a phase can be cancelled while it is the
// current one. Gates queue per url — each call takes the next one — so two
// overlapping runs can be parked and released independently.
const gates = new Map<string, Promise<void>[]>();
const releases = new Map<string, (() => void)[]>();
const heldUploads = new Set<string>();

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const holdRequest = (url: string) => {
  const queued = gates.get(url) ?? [];
  const waiting = releases.get(url) ?? [];
  queued.push(
    new Promise<void>((resolve) => {
      waiting.push(resolve);
    }),
  );
  gates.set(url, queued);
  releases.set(url, waiting);
};

const releaseRequest = async (url: string) => {
  releases.get(url)?.shift()?.();
  await tick();
};

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
  const gate = gates.get(url)?.shift();
  if (gate !== undefined) await gate;
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

const refusalBody = (code: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code>` +
  `<Message>whatever R2 says</Message></Error>`;

class FakeXhr {
  status = 0;
  responseText = '';
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
    const refusal = refusals.get(this.call.url);
    this.status = refusal ? refusal.status : uploadStatus;
    this.responseText = refusal ? refusal.body : '';
    if (heldUploads.has(this.call.url)) return;
    const failed = failing.has(this.call.url);
    queueMicrotask(() => {
      if (!failed && !refusal) {
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
  refusals.clear();
  gates.clear();
  releases.clear();
  heldUploads.clear();
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

describe('cancelling is a discard', () => {
  const deleteUrl = `/api/entries/${ENTRY_ID}`;

  const keeping = (upload: ReturnType<typeof useMediaUpload>) =>
    upload.submit(composeInput({ file: audioFile() }), { entryId: undefined });

  test('creating: awaits the id rather than aborting, then deletes it', async () => {
    const upload = useMediaUpload();
    holdRequest('/api/entries');

    const run = keeping(upload);
    await tick();
    expect(upload.phase.value).toBe('creating');

    upload.cancel();
    await releaseRequest('/api/entries');

    expect(await run).toBeNull();
    expect(sequence()).toEqual(['POST /api/entries', `DELETE ${deleteUrl}`]);
    expect(upload.phase.value).toBe('idle');
  });

  test('uploading: aborts the bytes, then deletes', async () => {
    const upload = useMediaUpload();
    heldUploads.add(UPLOAD_URL);

    const run = keeping(upload);
    await tick();
    expect(upload.phase.value).toBe('uploading');

    upload.cancel();

    expect(await run).toBeNull();
    expect(sequence()).toEqual([
      'POST /api/entries',
      `PUT ${UPLOAD_URL}`,
      `DELETE ${deleteUrl}`,
    ]);
    expect(upload.phase.value).toBe('idle');
  });

  test('finalizing: lets the confirm land, then deletes', async () => {
    const upload = useMediaUpload();
    holdRequest('/api/media/confirm');

    const run = keeping(upload);
    await tick();
    expect(upload.phase.value).toBe('finalizing');

    upload.cancel();
    await releaseRequest('/api/media/confirm');

    expect(await run).toBeNull();
    expect(sequence()).toEqual([
      'POST /api/entries',
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
      `DELETE ${deleteUrl}`,
    ]);
    expect(upload.phase.value).toBe('idle');
  });

  test('error: the word created on the way out goes too', async () => {
    const upload = useMediaUpload();
    failing.add('/api/media/confirm');

    await keeping(upload);
    expect(upload.phase.value).toBe('error');
    requests.length = 0;

    upload.cancel();

    expect(sequence()).toEqual([`DELETE ${deleteUrl}`]);
    expect(upload.phase.value).toBe('idle');
    expect(upload.errorMessage.value).toBeUndefined();
  });

  test('idle: with nothing created there is nothing to delete', async () => {
    const upload = useMediaUpload();

    upload.cancel();

    expect(sequence()).toEqual([]);
    expect(upload.phase.value).toBe('idle');
  });

  test('an entry the caller brought is never deleted, mid-upload', async () => {
    const upload = useMediaUpload();
    heldUploads.add(UPLOAD_URL);

    const run = upload.submit(composeInput({ file: audioFile() }), {
      entryId: ENTRY_ID,
    });
    await tick();
    upload.cancel();

    expect(await run).toBeNull();
    expect(sequence()).toEqual([
      `POST /api/entries/${ENTRY_ID}/media`,
      `PUT ${UPLOAD_URL}`,
    ]);
  });

  test('an entry the caller brought is never deleted, after a failure', async () => {
    const upload = useMediaUpload();
    failing.add('/api/media/confirm');

    await upload.submit(composeInput({ file: audioFile() }), {
      entryId: ENTRY_ID,
    });
    requests.length = 0;

    upload.cancel();

    expect(sequence()).toEqual([]);
  });

  test('a re-mint that fails while cancelled still takes the word', async () => {
    const upload = useMediaUpload();
    refusals.set(UPLOAD_URL, {
      status: 403,
      body: refusalBody('AccessDenied'),
    });

    await keeping(upload);
    expect(upload.phase.value).toBe('error');

    const attachUrl = `/api/entries/${ENTRY_ID}/media`;
    refusals.clear();
    failing.add(attachUrl);
    holdRequest(attachUrl);
    requests.length = 0;

    const run = keeping(upload);
    await tick();
    upload.cancel();
    await releaseRequest(attachUrl);

    expect(await run).toBeNull();
    expect(sequence()).toEqual([`POST ${attachUrl}`, `DELETE ${deleteUrl}`]);
    expect(upload.phase.value).toBe('idle');
  });

  test('a word already kept is not this session to throw away', async () => {
    const upload = useMediaUpload();

    expect(await keeping(upload)).toEqual({ entryId: ENTRY_ID });
    requests.length = 0;

    upload.cancel();

    expect(sequence()).toEqual([]);
  });

  test('cancelling twice deletes both words and revives neither', async () => {
    const upload = useMediaUpload();
    holdRequest('/api/entries');
    holdRequest('/api/entries');

    const first = keeping(upload);
    await tick();
    upload.cancel();

    upload.reset();
    const second = keeping(upload);
    await tick();
    upload.cancel();

    await releaseRequest('/api/entries');
    await releaseRequest('/api/entries');

    expect(await first).toBeNull();
    expect(await second).toBeNull();
    expect(sequence()).toEqual([
      'POST /api/entries',
      'POST /api/entries',
      `DELETE ${deleteUrl}`,
      `DELETE ${deleteUrl}`,
    ]);
    expect(upload.phase.value).toBe('idle');
  });

  test('cancelling aborts every upload still running', async () => {
    const upload = useMediaUpload();
    heldUploads.add(UPLOAD_URL);

    const first = keeping(upload);
    await tick();
    const second = keeping(upload);
    await tick();

    upload.cancel();

    expect(await first).toBeNull();
    expect(await second).toBeNull();
    expect(upload.phase.value).toBe('idle');
  });

  test('a discard asked before the word landed still takes it', async () => {
    const upload = useMediaUpload();
    holdRequest('/api/media/confirm');

    const run = keeping(upload);
    await tick();
    expect(upload.phase.value).toBe('finalizing');

    upload.askCancel();
    await releaseRequest('/api/media/confirm');
    expect(await run).toEqual({ entryId: ENTRY_ID });
    expect(upload.phase.value).toBe('done');

    requests.length = 0;
    upload.cancel();

    expect(sequence()).toEqual([`DELETE ${deleteUrl}`]);
    expect(upload.phase.value).toBe('idle');
  });

  test('un-asking leaves the word that landed meanwhile alone', async () => {
    const upload = useMediaUpload();
    holdRequest('/api/media/confirm');

    const run = keeping(upload);
    await tick();
    upload.askCancel();
    await releaseRequest('/api/media/confirm');
    expect(await run).toEqual({ entryId: ENTRY_ID });

    requests.length = 0;
    upload.unaskCancel();
    upload.cancel();

    expect(sequence()).toEqual([]);
  });

  test('a cancelled run leaves the word that replaced it alone', async () => {
    const upload = useMediaUpload();
    holdRequest('/api/entries');

    const abandoned = keeping(upload);
    await tick();
    upload.cancel();

    // The sheet closed and reopened: a second word runs to completion while
    // the cancelled one is still parked on its create.
    upload.reset();
    const kept = keeping(upload);
    await tick();
    await releaseRequest('/api/entries');

    expect(await abandoned).toBeNull();
    expect(await kept).toEqual({ entryId: ENTRY_ID });
    expect(upload.phase.value).toBe('done');
  });
});

describe('a refused PUT', () => {
  const keep = (upload: ReturnType<typeof useMediaUpload>) =>
    upload.submit(composeInput({ file: audioFile() }), { entryId: undefined });

  test('keeps the code R2 named instead of only the status', async () => {
    const upload = useMediaUpload();
    refusals.set(UPLOAD_URL, {
      status: 403,
      body: refusalBody('SignatureDoesNotMatch'),
    });

    expect(await keep(upload)).toBeNull();
    expect(upload.phase.value).toBe('error');
    expect(upload.errorCode.value).toBe('SignatureDoesNotMatch');
  });

  test('re-mints the slot when the signature is the thing refused', async () => {
    const upload = useMediaUpload();
    refusals.set(UPLOAD_URL, {
      status: 403,
      body: refusalBody('AccessDenied'),
    });

    expect(await keep(upload)).toBeNull();
    expect(upload.errorCode.value).toBe('AccessDenied');

    refusals.clear();
    requests.length = 0;
    const retry = await keep(upload);

    expect(retry).toEqual({ entryId: ENTRY_ID });
    expect(sequence()).toEqual([
      `POST /api/entries/${ENTRY_ID}/media`,
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('resumes the same slot when the bytes were the problem', async () => {
    const upload = useMediaUpload();
    refusals.set(UPLOAD_URL, {
      status: 400,
      body: refusalBody('EntityTooLarge'),
    });

    expect(await keep(upload)).toBeNull();
    expect(upload.errorCode.value).toBe('EntityTooLarge');

    refusals.clear();
    requests.length = 0;
    await keep(upload);

    expect(sequence()).toEqual([
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('reads an unnamed refusal as transient, not as a dead slot', async () => {
    const upload = useMediaUpload();
    refusals.set(UPLOAD_URL, { status: 503, body: '' });

    expect(await keep(upload)).toBeNull();
    expect(upload.errorCode.value).toBeUndefined();

    refusals.clear();
    requests.length = 0;
    await keep(upload);

    expect(sequence()).toEqual([
      `PUT ${UPLOAD_URL}`,
      'POST /api/media/confirm',
    ]);
  });

  test('a dropped connection carries no code at all', async () => {
    const upload = useMediaUpload();
    failing.add(UPLOAD_URL);

    expect(await keep(upload)).toBeNull();
    expect(upload.errorCode.value).toBeUndefined();
    expect(upload.errorMessage.value).toBe('The upload did not finish.');
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
