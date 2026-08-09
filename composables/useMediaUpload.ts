export type ComposePhase =
  | 'idle'
  | 'creating'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'error';

export interface ComposeInput {
  word: string;
  gloss: string;
  // Speaker id from the chip row (VKB-97); absent attributes the word to the
  // user themselves.
  sid: string | undefined;
  story: string;
  file: File | null;
}

// Absent composes a fresh word; an id attaches media to that existing entry.
export interface ComposeTarget {
  entryId: string | undefined;
}

interface UploadSlot {
  uploadUrl: string;
  key: string;
  mediaId: string;
  maxBytes: number;
}

interface PendingUpload {
  entryId: string;
  upload: UploadSlot | null;
  // The caller target this belongs to, not the entry it reached: a fresh word
  // stays `undefined` across a swap, because the entry is still this
  // session's own.
  openedFor: string | undefined;
}

const messageFromError = (error: unknown, fallback: string): string => {
  const data = (
    error as { data?: { statusMessage?: string; message?: string } }
  )?.data;
  return data?.statusMessage ?? data?.message ?? fallback;
};

class UploadAbort extends Error {
  constructor() {
    super('upload aborted');
    this.name = 'UploadAbort';
  }
}

class UploadError extends Error {
  code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super(`upload failed (${status})`);
    this.name = 'UploadError';
    this.code = code;
  }
}

const S3_ERROR_CODE_RE = /<Code>([^<]+)<\/Code>/;

// S3 and R2 refuse a PUT with an XML body naming the cause. A cross-origin
// refusal only exposes it when the error response carries the CORS headers,
// so an absent code means "unknown", never "fine".
const parseUploadErrorCode = (body: string): string | undefined =>
  S3_ERROR_CODE_RE.exec(body)?.[1];

// Refusals of the signature itself: these condemn the slot, not the bytes, so
// resuming against it can only fail identically. EntityTooLarge is absent on
// purpose — a fresh slot pins the same length and would be refused again.
const DEAD_SLOT_CODES: ReadonlySet<string> = new Set([
  'AccessDenied',
  'ExpiredToken',
  'RequestTimeTooSkewed',
  'SignatureDoesNotMatch',
]);

const isDeadSlot = (error: unknown): boolean =>
  error instanceof UploadError &&
  error.code !== undefined &&
  DEAD_SLOT_CODES.has(error.code);

const SETTLING_PHASES: ReadonlySet<ComposePhase> = new Set([
  'creating',
  'uploading',
  'finalizing',
]);

// Deleting the entry detaches its in-flight media row rather than orphaning
// it: `entry_id` cascades and `pending_entry_id` is set null, so the row that
// arrives later finds nothing to claim (ADR-0009). Nobody waits for this —
// the sheet is already gone, and a failure leaves the same orphan today's
// cancel does.
const discardEntry = async (entryId: string) => {
  try {
    await $fetch(`/api/entries/${encodeURIComponent(entryId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    console.error('[useMediaUpload] discarding a cancelled word failed', error);
  }
};

const putWithProgress = (
  slot: UploadSlot,
  file: File,
  onProgress: (pct: number) => void,
  onStart: (xhr: XMLHttpRequest) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', slot.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        reject(
          new UploadError(xhr.status, parseUploadErrorCode(xhr.responseText)),
        );
      }
    });
    xhr.addEventListener('error', () =>
      reject(new Error('upload network error')),
    );
    xhr.addEventListener('abort', () => reject(new UploadAbort()));
    onStart(xhr);
    xhr.send(file);
  });

const omitIfBlank = (value: string) => value.trim() || undefined;

const toMediaDeclaration = (file: File) => ({
  contentType: file.type,
  sizeBytes: file.size,
});

const createEntry = async (input: ComposeInput) => {
  const created = await $fetch<{
    entry: { id: string };
    upload: UploadSlot | null;
  }>('/api/entries', {
    method: 'POST',
    credentials: 'include',
    body: {
      word: input.word.trim(),
      gloss: omitIfBlank(input.gloss),
      sid: input.sid,
      story: omitIfBlank(input.story),
      media: input.file ? toMediaDeclaration(input.file) : undefined,
    },
  });
  return { entryId: created.entry.id, upload: created.upload };
};

const attachMedia = async (entryId: string, file: File) => {
  const attached = await $fetch<{ upload: UploadSlot }>(
    `/api/entries/${encodeURIComponent(entryId)}/media`,
    {
      method: 'POST',
      credentials: 'include',
      body: toMediaDeclaration(file),
    },
  );
  return { entryId, upload: attached.upload };
};

export const useMediaUpload = () => {
  const phase = ref<ComposePhase>('idle');
  const progress = ref(0);
  const errorMessage = ref<string | undefined>();
  const errorCode = ref<string | undefined>();

  // Both endpoints commit their row before answering, so a retry has to reuse
  // the slot rather than mint a second one.
  let resumeFrom: PendingUpload | null = null;
  let inFlight: XMLHttpRequest | null = null;

  // Cancelling closes the sheet at once and cleans up behind the user, so a
  // second submit can start while the first is still unwinding. Both are
  // named by run, otherwise the late one clears the live one's state.
  let runId = 0;
  let cancelledRun = 0;

  const reset = () => {
    phase.value = 'idle';
    progress.value = 0;
    errorMessage.value = undefined;
    errorCode.value = undefined;
    resumeFrom = null;
    inFlight = null;
  };

  const fail = (error: unknown, fallback: string) => {
    const data = (error as { data?: { data?: { code?: string } } })?.data;
    errorCode.value =
      error instanceof UploadError ? error.code : data?.data?.code;
    errorMessage.value = messageFromError(error, fallback);
    phase.value = 'error';
    return null;
  };

  // Two gestures, two verbs. reset() forgets the entry entirely; swap() keeps
  // the word already created and drops only its slot, so the next Keep
  // attaches the new file instead of creating a second entry.
  const swap = () => {
    phase.value = 'idle';
    progress.value = 0;
    errorMessage.value = undefined;
    errorCode.value = undefined;
    if (resumeFrom !== null) resumeFrom = { ...resumeFrom, upload: null };
  };

  const abandonRun = (run: number) => {
    if (run === runId) reset();
    return null;
  };

  const discardRun = (run: number, entryId: string, isOwnEntry: boolean) => {
    if (isOwnEntry) void discardEntry(entryId);
    return abandonRun(run);
  };

  // Cancel is a discard: when it settles, nothing this session created is
  // left. A run still in flight cleans up at its next checkpoint — aborting
  // the client would not roll the server back — so all this has to do is
  // mark it, and finish the job itself when no run is left to reach one.
  const cancel = () => {
    cancelledRun = runId;
    if (inFlight !== null) {
      inFlight.abort();
      return;
    }
    if (SETTLING_PHASES.has(phase.value)) return;
    // A word already kept is not this session's to throw away.
    const pending = phase.value === 'done' ? null : resumeFrom;
    if (pending === null) {
      abandonRun(runId);
      return;
    }
    discardRun(runId, pending.entryId, pending.openedFor === undefined);
  };

  const submit = async (
    input: ComposeInput,
    target: ComposeTarget,
  ): Promise<{ entryId: string } | null> => {
    const run = ++runId;
    errorMessage.value = undefined;
    errorCode.value = undefined;

    const attachTo = target.entryId;
    const { file } = input;
    // Only an entry this session created is ours to throw away; one the
    // caller brought belongs to them.
    const isOwnEntry = attachTo === undefined;

    // A slot belongs to the target it was opened for — a fresh word included;
    // any other target is a new submission, not a retry.
    if (resumeFrom && resumeFrom.openedFor !== attachTo) resumeFrom = null;

    // Attaching nothing makes no request, so it must never occupy the resume
    // slot — a later submit carrying a file still has to reach the server.
    if (attachTo !== undefined && file === null) {
      phase.value = 'done';
      return { entryId: attachTo };
    }

    // An entry already created keeps its id: only the slot is minted again,
    // through the attach route.
    let pending = resumeFrom;
    if (pending === null || (pending.upload === null && file !== null)) {
      const into = pending?.entryId ?? attachTo;
      progress.value = 0;
      phase.value = 'creating';
      try {
        const opened =
          into !== undefined && file !== null
            ? await attachMedia(into, file)
            : await createEntry(input);
        // Before the shared state, so a cancelled run cannot hand its slot
        // to the run that replaced it.
        if (cancelledRun === run) {
          return discardRun(run, opened.entryId, isOwnEntry);
        }
        pending = { ...opened, openedFor: attachTo };
        resumeFrom = pending;
      } catch (error) {
        // A re-mint that fails still leaves the entry an earlier run created,
        // and a cancel has to take that with it.
        if (cancelledRun === run) {
          return pending === null
            ? abandonRun(run)
            : discardRun(run, pending.entryId, isOwnEntry);
        }
        return fail(
          error,
          into === undefined
            ? 'Could not save this word.'
            : 'Could not attach this media.',
        );
      }
    }

    const { entryId, upload: slot } = pending;
    if (!file || !slot) {
      phase.value = 'done';
      return { entryId };
    }

    phase.value = 'uploading';
    progress.value = 0;
    try {
      await putWithProgress(
        slot,
        file,
        (pct) => {
          progress.value = pct;
        },
        (xhr) => {
          inFlight = xhr;
        },
      );
    } catch (error) {
      if (cancelledRun !== run) {
        if (error instanceof UploadAbort) {
          phase.value = 'idle';
          return null;
        }
        if (isDeadSlot(error)) {
          resumeFrom = { entryId, upload: null, openedFor: attachTo };
        }
        return fail(error, 'The upload did not finish.');
      }
    } finally {
      inFlight = null;
    }

    if (cancelledRun === run) return discardRun(run, entryId, isOwnEntry);

    phase.value = 'finalizing';
    try {
      await $fetch('/api/media/confirm', {
        method: 'POST',
        credentials: 'include',
        body: { key: slot.key },
      });
    } catch (error) {
      if (cancelledRun !== run) {
        return fail(error, 'We could not start processing.');
      }
    }

    if (cancelledRun === run) return discardRun(run, entryId, isOwnEntry);

    phase.value = 'done';
    return { entryId };
  };

  return {
    phase,
    progress,
    errorMessage,
    errorCode,
    submit,
    reset,
    swap,
    cancel,
  };
};
