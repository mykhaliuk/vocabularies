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
      else reject(new Error(`upload failed (${xhr.status})`));
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

const createEntry = async (input: ComposeInput): Promise<PendingUpload> => {
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
  return {
    entryId: created.entry.id,
    upload: created.upload,
    openedFor: undefined,
  };
};

const attachMedia = async (
  entryId: string,
  file: File,
): Promise<PendingUpload> => {
  const attached = await $fetch<{ upload: UploadSlot }>(
    `/api/entries/${encodeURIComponent(entryId)}/media`,
    {
      method: 'POST',
      credentials: 'include',
      body: toMediaDeclaration(file),
    },
  );
  return { entryId, upload: attached.upload, openedFor: entryId };
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
    errorCode.value = data?.data?.code;
    errorMessage.value = messageFromError(error, fallback);
    phase.value = 'error';
    return null;
  };

  // Aborts an in-flight upload so the sheet is never an inescapable modal.
  const cancel = () => {
    inFlight?.abort();
    inFlight = null;
  };

  const submit = async (
    input: ComposeInput,
    target: ComposeTarget,
  ): Promise<{ entryId: string } | null> => {
    errorMessage.value = undefined;
    errorCode.value = undefined;

    const attachTo = target.entryId;
    const { file } = input;

    // A slot belongs to the target it was opened for — a fresh word included;
    // any other target is a new submission, not a retry.
    if (resumeFrom && resumeFrom.openedFor !== attachTo) resumeFrom = null;

    // Attaching nothing makes no request, so it must never occupy the resume
    // slot — a later submit carrying a file still has to reach the server.
    if (attachTo !== undefined && file === null) {
      phase.value = 'done';
      return { entryId: attachTo };
    }

    if (!resumeFrom) {
      progress.value = 0;
      phase.value = 'creating';
      try {
        resumeFrom =
          attachTo !== undefined && file !== null
            ? await attachMedia(attachTo, file)
            : await createEntry(input);
      } catch (error) {
        return fail(
          error,
          attachTo === undefined
            ? 'Could not save this word.'
            : 'Could not attach this media.',
        );
      }
    }

    const { entryId, upload: slot } = resumeFrom;
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
      if (error instanceof UploadAbort) {
        phase.value = 'idle';
        return null;
      }
      return fail(error, 'The upload did not finish.');
    } finally {
      inFlight = null;
    }

    phase.value = 'finalizing';
    try {
      await $fetch('/api/media/confirm', {
        method: 'POST',
        credentials: 'include',
        body: { key: slot.key },
      });
    } catch (error) {
      return fail(error, 'We could not start processing.');
    }

    phase.value = 'done';
    return { entryId };
  };

  return { phase, progress, errorMessage, errorCode, submit, reset, cancel };
};
