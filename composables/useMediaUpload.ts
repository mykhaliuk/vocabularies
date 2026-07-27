// Drives the compose write path (ADR-0009, upload-first). Mirrors the proven
// sequence in pages/dev/media-spike.vue, but through the entry-bound endpoint
// so the entry appears in the feed as `processing` the moment it is created:
//
//   1. POST /api/entries { ...fields, media?: { contentType, sizeBytes } }
//        -> { entry, media, upload: { uploadUrl, key, mediaId, maxBytes } }
//   2. PUT the raw bytes to the presigned uploadUrl (XHR, for progress)
//   3. POST /api/media/confirm { key }  -> enqueues transcoding
//
// It intentionally does NOT poll to `ready`: the feed owns that transition.

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
  speaker: string;
  story: string;
  file: File | null;
}

interface UploadSlot {
  uploadUrl: string;
  key: string;
  mediaId: string;
  maxBytes: number;
}
interface CreateEntryResponse {
  entry: { id: string };
  upload: UploadSlot | null;
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

export const useMediaUpload = () => {
  const phase = ref<ComposePhase>('idle');
  const progress = ref(0);
  const errorMessage = ref<string | null>(null);
  const errorCode = ref<string | null>(null);

  // Survives a failed attempt so a retry RESUMES (re-PUT / re-confirm against
  // the same slot) instead of posting a second entry. POST /api/entries already
  // inserted the entry + its processing media row, and the server only rolls
  // those back when minting the slot fails — so re-running step 1 would leave
  // the first entry stuck on 'processing' forever.
  let pending: CreateEntryResponse | null = null;
  let inFlight: XMLHttpRequest | null = null;

  const reset = () => {
    phase.value = 'idle';
    progress.value = 0;
    errorMessage.value = null;
    errorCode.value = null;
    pending = null;
    inFlight = null;
  };

  const fail = (error: unknown, fallback: string) => {
    const data = (error as { data?: { data?: { code?: string } } })?.data;
    errorCode.value = data?.data?.code ?? null;
    errorMessage.value = messageFromError(error, fallback);
    phase.value = 'error';
    return null;
  };

  // Aborts an in-flight upload so the sheet is never an inescapable modal.
  const cancel = () => {
    inFlight?.abort();
    inFlight = null;
  };

  // Returns the created entry id on success, or null if it failed. On failure
  // `phase` is 'error' and `errorMessage` carries a human-readable reason;
  // calling submit() again resumes the same entry rather than duplicating it.
  const submit = async (
    input: ComposeInput,
  ): Promise<{ entryId: string } | null> => {
    errorMessage.value = null;
    errorCode.value = null;

    if (!pending) {
      progress.value = 0;
      phase.value = 'creating';
      try {
        pending = await $fetch<CreateEntryResponse>('/api/entries', {
          method: 'POST',
          credentials: 'include',
          body: {
            word: input.word.trim(),
            gloss: input.gloss.trim() || undefined,
            speaker: input.speaker.trim() || undefined,
            story: input.story.trim() || undefined,
            media: input.file
              ? { contentType: input.file.type, sizeBytes: input.file.size }
              : undefined,
          },
        });
      } catch (error) {
        return fail(error, 'Could not save this word.');
      }
    }

    const slot = pending.upload;
    if (!input.file || !slot) {
      phase.value = 'done';
      return { entryId: pending.entry.id };
    }

    phase.value = 'uploading';
    progress.value = 0;
    try {
      await putWithProgress(
        slot,
        input.file,
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
    return { entryId: pending.entry.id };
  };

  return { phase, progress, errorMessage, errorCode, submit, reset, cancel };
};
