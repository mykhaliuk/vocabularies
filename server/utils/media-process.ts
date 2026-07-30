import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {
  DURATION_TOLERANCE_SEC,
  MAX_AUDIO_DURATION_SEC,
  MAX_VIDEO_DURATION_SEC,
  derivedKeys,
  parseOriginalKey,
} from './media-key';
import { getObject, isNotFoundError, putFile, putObject } from './storage';
import type { Readable } from 'node:stream';

const execFileAsync = promisify(execFile);

const PEAK_COUNT = 96;
const PEAKS_SAMPLE_RATE_HZ = 8000;
const VIDEO_TARGET_EDGE_PX = 720;
const EXEC_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
// Unknown-duration sources are transcoded with -t set to cap + epsilon;
// a derivative longer than the cap therefore proves the source exceeded
// the limit, while clips inside the tolerance band survive untouched —
// the same acceptance threshold the known-duration path uses.
const CAP_DETECT_EPSILON_SEC = 0.1;

export interface MediaTimings {
  downloadMs: number;
  probeMs: number;
  transcodeMs: number;
  posterMs: number;
  peaksMs: number;
  uploadMs: number;
  totalMs: number;
}

export interface MediaManifest {
  status: 'ready';
  kind: 'audio' | 'video';
  durationSec: number;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
  sourceBytes: number;
  sourceCodecs: string[];
  timings: MediaTimings;
  processedAt: string;
}

// Written to the manifest key when processing dies, so a failed job is an
// observable state instead of an eternal "processing" inferred from
// absence.
export interface MediaFailure {
  status: 'failed';
  error: string;
  processedAt: string;
}

// A rejection whose message is safe to show to the user (too long,
// unreadable file). Everything else — ffmpeg stderr, S3 errors, key
// layout — stays in server logs; the client gets a generic message.
export class MediaRejection extends Error {}

export interface ProcessMediaOptions {
  // Deliberate reprocess opt-out (VKB-81): bypasses the ready-manifest
  // guard below. Nothing in this codebase sets it yet — no reprocess
  // action exists — but the guard needs an escape hatch from day one, so
  // a future admin/CLI trigger can call processMedia again on purpose
  // without the guard silently eating it.
  force?: boolean;
}

interface ProbeResult {
  durationSec: number | null;
  hasVideo: boolean;
  codecs: string[];
  width: number | null;
  height: number | null;
}

// Metadata comes from parsing `ffmpeg -i` banner output instead of ffprobe:
// @ffprobe-installer resolves its 76MB platform binary with a dynamic
// require that Nitro's tracer cannot follow, so the binary silently misses
// the serverless bundle. The banner format (Duration / Stream lines) has
// been stable for over a decade and carries everything the pipeline needs.
const DURATION_PATTERN = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;
const STREAM_PATTERN = /Stream #\d+:\d+[^:]*: (Video|Audio): ([A-Za-z0-9_]+)/g;
const DIMENSIONS_PATTERN = /, (\d{2,5})x(\d{2,5})[\s,[]/;

// Album cover art embedded in mp3/m4a appears in the banner as a Video
// stream. The pinned 2018 ffmpeg build does NOT print the "(attached pic)"
// marker (verified empirically — the string is absent from the binary), so
// the discriminator is the codec: covers are still-image codecs. Real
// moments from phones are never motion-JPEG, so the trade-off is safe.
const STILL_IMAGE_CODECS = new Set(['mjpeg', 'png', 'bmp', 'gif', 'tiff']);

const isExecError = (error: unknown): error is { stderr: string } =>
  typeof error === 'object' &&
  error !== null &&
  'stderr' in error &&
  typeof (error as { stderr: unknown }).stderr === 'string';

const probeBanner = async (path: string): Promise<ProbeResult> => {
  // `ffmpeg -i <file>` with no output exits non-zero by design; the banner
  // we need is on stderr either way.
  let banner = '';
  try {
    const { stderr } = await execFileAsync(
      ffmpegInstaller.path,
      ['-hide_banner', '-i', path],
      { maxBuffer: EXEC_MAX_BUFFER_BYTES },
    );
    banner = stderr;
  } catch (error) {
    if (!isExecError(error)) throw error;
    banner = error.stderr;
  }

  const durationMatch = banner.match(DURATION_PATTERN);
  const durationSec = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : null;

  let hasVideo = false;
  let width: number | null = null;
  let height: number | null = null;
  const codecs: string[] = [];
  for (const match of banner.matchAll(STREAM_PATTERN)) {
    const streamType = match[1];
    const codecName = match[2];
    if (codecName) codecs.push(codecName);
    if (streamType !== 'Video') continue;
    if (codecName && STILL_IMAGE_CODECS.has(codecName)) continue;
    const line = banner.slice(match.index).split('\n', 1)[0] ?? '';
    // Belt to the codec-set suspenders: newer ffmpeg builds do print the
    // attached-pic marker.
    if (line.includes('attached pic')) continue;
    hasVideo = true;
    const dims = line.match(DIMENSIONS_PATTERN);
    if (dims) {
      width = Number(dims[1]);
      height = Number(dims[2]);
    }
  }

  return { durationSec, hasVideo, codecs, width, height };
};

const runFfmpeg = async (args: string[]) => {
  await execFileAsync(ffmpegInstaller.path, ['-y', '-v', 'error', ...args], {
    maxBuffer: EXEC_MAX_BUFFER_BYTES,
  });
};

// Mono 8kHz PCM decode → PEAK_COUNT max-abs buckets normalized to 0..100.
// Computing peaks server-side is what frees the client from capturing them
// at record time (there is no record time — uploads only).
const extractPeaks = async (path: string): Promise<number[] | null> => {
  let pcm: Buffer;
  try {
    const { stdout } = await execFileAsync(
      ffmpegInstaller.path,
      [
        '-v',
        'error',
        '-i',
        path,
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(PEAKS_SAMPLE_RATE_HZ),
        '-f',
        's16le',
        'pipe:1',
      ],
      { maxBuffer: EXEC_MAX_BUFFER_BYTES, encoding: 'buffer' },
    );
    pcm = stdout;
  } catch (error) {
    // A silent movie has no audio stream — peaks are simply absent.
    console.warn('[media-process] peaks extraction failed', { error });
    return null;
  }

  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount === 0) return null;

  const bucketSize = Math.max(1, Math.floor(sampleCount / PEAK_COUNT));
  const peaks = Array.from(
    { length: Math.min(PEAK_COUNT, sampleCount) },
    () => 0,
  );
  for (let i = 0; i < peaks.length; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, sampleCount);
    let max = 0;
    for (let s = start; s < end; s++) {
      const value = Math.abs(pcm.readInt16LE(s * 2));
      if (value > max) max = value;
    }
    peaks[i] = Math.round((max / 32768) * 100);
  }
  return peaks;
};

const downloadOriginal = async (key: string, destination: string) => {
  const response = await getObject(key, 'originals');
  const body = response.Body;
  if (!body) throw new Error('[media-process] empty original body');
  await pipeline(body as Readable, createWriteStream(destination));
  return Number(response.ContentLength ?? 0);
};

// Scale so the SHORT edge lands on 720 (portrait phone video stays
// 720-wide, landscape stays 720-tall); never upscale. -2 keeps the other
// edge even, which libx264 requires.
const SCALE_720 =
  `scale=w='if(gt(iw,ih),-2,min(${VIDEO_TARGET_EDGE_PX},iw))'` +
  `:h='if(gt(iw,ih),min(${VIDEO_TARGET_EDGE_PX},ih),-2)'`;

const durationLimitSec = (kind: 'audio' | 'video') =>
  kind === 'video' ? MAX_VIDEO_DURATION_SEC : MAX_AUDIO_DURATION_SEC;

const runPipeline = async (
  key: string,
  userId: string,
  mediaId: string,
  workDir: string,
  startedAt: number,
): Promise<MediaManifest> => {
  const originalPath = join(workDir, 'original');
  const downloadStart = Date.now();
  const sourceBytes = await downloadOriginal(key, originalPath);
  const downloadMs = Date.now() - downloadStart;

  const probeStart = Date.now();
  const probe = await probeBanner(originalPath);
  const probeMs = Date.now() - probeStart;

  const kind = probe.hasVideo ? 'video' : 'audio';
  const sourceCodecs = probe.codecs;
  // Per-kind limits: video is capped tight, audio may run to minutes.
  const limitSec = durationLimitSec(kind);
  const capSec = limitSec + DURATION_TOLERANCE_SEC;

  // Some valid containers (browser MediaRecorder WebM) report no duration
  // in the banner. Those are NOT rejected: the transcode is capped with -t
  // and the real duration is read back from the derivative, which always
  // carries one (mp4/m4a moov box).
  const sourceDurationSec = probe.durationSec;
  if (sourceDurationSec !== null && sourceDurationSec > capSec) {
    throw new MediaRejection(
      `${kind} moment is ${sourceDurationSec.toFixed(1)}s — the limit is ${limitSec}s`,
    );
  }
  const capArgs =
    sourceDurationSec === null
      ? ['-t', String(capSec + CAP_DETECT_EPSILON_SEC)]
      : [];

  const keys = derivedKeys(userId, mediaId);
  let width: number | null = null;
  let height: number | null = null;
  let derivedDurationSec: number | null = null;
  let transcodeMs = 0;
  let posterMs = 0;
  const uploads: Array<Promise<unknown>> = [];

  // Peaks only read the original — they run concurrently with the
  // transcode instead of adding their decode to the wall clock.
  const peaksStart = Date.now();
  const peaksPromise = extractPeaks(originalPath).then((peaks) => ({
    peaks,
    peaksMs: Date.now() - peaksStart,
  }));

  if (kind === 'video') {
    const videoPath = join(workDir, 'video.mp4');
    const transcodeStart = Date.now();
    await runFfmpeg([
      '-i',
      originalPath,
      ...capArgs,
      '-vf',
      SCALE_720,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      videoPath,
    ]);
    transcodeMs = Date.now() - transcodeStart;

    const posterPath = join(workDir, 'poster.jpg');
    const posterStart = Date.now();
    await runFfmpeg([
      '-i',
      videoPath,
      '-ss',
      '0.5',
      '-frames:v',
      '1',
      '-q:v',
      '3',
      posterPath,
    ]);
    posterMs = Date.now() - posterStart;

    const derivedProbe = await probeBanner(videoPath);
    width = derivedProbe.width;
    height = derivedProbe.height;
    derivedDurationSec = derivedProbe.durationSec;

    uploads.push(
      putFile(keys.video, videoPath, 'video/mp4'),
      putFile(keys.poster, posterPath, 'image/jpeg'),
    );
  } else {
    const audioPath = join(workDir, 'audio.m4a');
    const transcodeStart = Date.now();
    await runFfmpeg([
      '-i',
      originalPath,
      ...capArgs,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      audioPath,
    ]);
    transcodeMs = Date.now() - transcodeStart;

    if (sourceDurationSec === null) {
      const derivedProbe = await probeBanner(audioPath);
      derivedDurationSec = derivedProbe.durationSec;
    }

    uploads.push(putFile(keys.audio, audioPath, 'audio/mp4'));
  }

  let durationSec = sourceDurationSec;
  if (durationSec === null) {
    durationSec = derivedDurationSec;
    if (durationSec === null) {
      throw new MediaRejection('could not read this file as audio or video');
    }
    if (durationSec > capSec) {
      throw new MediaRejection(
        `${kind} moment is longer than the ${limitSec}s limit`,
      );
    }
  }

  const { peaks, peaksMs } = await peaksPromise;

  const uploadStart = Date.now();
  await Promise.all(uploads);
  const uploadMs = Date.now() - uploadStart;

  const manifest: MediaManifest = {
    status: 'ready',
    kind,
    durationSec,
    width,
    height,
    peaks,
    sourceBytes,
    sourceCodecs,
    timings: {
      downloadMs,
      probeMs,
      transcodeMs,
      posterMs,
      peaksMs,
      uploadMs,
      totalMs: Date.now() - startedAt,
    },
    processedAt: new Date().toISOString(),
  };

  await putObject(
    keys.manifest,
    Buffer.from(JSON.stringify(manifest)),
    'application/json',
  );
  return manifest;
};

// Reads and parses the manifest key if one exists, for callers that need
// to know the prior outcome before acting. Returns null on NotFound (the
// normal first-run case); any OTHER read error is rethrown so each caller
// can apply its own risk tolerance — writeFailureManifest and
// processMedia's ready-guard need different fallbacks for "could not
// tell".
const readManifestIfExists = async (
  manifestKey: string,
): Promise<MediaManifest | MediaFailure | null> => {
  try {
    const existing = await getObject(manifestKey, 'media');
    const raw = await existing.Body?.transformToString();
    return raw ? (JSON.parse(raw) as MediaManifest | MediaFailure) : null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
};

// QStash delivers at-least-once: a retry of an already-completed job can
// fail on a transient and must NOT clobber the ready manifest a previous
// run wrote — failed→ready self-heals on retry, ready→failed would be
// permanent. Only write the failure when no ready manifest exists.
// Returns whether a terminal manifest (failed just written, or an
// already-present ready one) is durably in place — callers use it to
// decide if the job outcome is recorded or a retry is still needed.
const writeFailureManifest = async (
  userId: string,
  mediaId: string,
  key: string,
  error: unknown,
): Promise<boolean> => {
  const { manifest } = derivedKeys(userId, mediaId);
  let existing: MediaManifest | MediaFailure | null;
  try {
    existing = await readManifestIfExists(manifest);
  } catch (readError) {
    // A read error here is a transient exactly when a retry-after-transient
    // is running, so writing now risks clobbering a ready manifest we
    // could not see; skip instead and report the outcome as unrecorded so
    // the caller keeps the retry path alive.
    console.error(
      '[media-process] manifest read failed — skipping failure write',
      { key, readError },
    );
    return false;
  }
  if (existing?.status === 'ready') {
    console.warn(
      '[media-process] retry failed but ready manifest exists — keeping it',
      { key },
    );
    return true;
  }

  // Only MediaRejection messages are client-safe; anything else (ffmpeg
  // stderr, storage errors) is logged server-side and replaced with a
  // generic message so internals never reach the client.
  console.error('[media-process] processing failed', { key, error });
  const failure: MediaFailure = {
    status: 'failed',
    error:
      error instanceof MediaRejection ? error.message : 'processing failed',
    processedAt: new Date().toISOString(),
  };
  try {
    await putObject(
      manifest,
      Buffer.from(JSON.stringify(failure)),
      'application/json',
    );
    return true;
  } catch (writeError) {
    console.error('[media-process] failed to write failure manifest', {
      key,
      writeError,
    });
    return false;
  }
};

// Pure predicate extracted for unit coverage (VKB-81): does `existing`
// carry durable proof of completion? A 'ready' manifest means the ffmpeg
// run and derivative uploads already happened; a 'failed' one does NOT —
// the job must still run so it can self-heal. The belt-and-braces checks
// beyond the status string (durationSec is a number, kind is one of the
// two known values) guard against a manifest that parsed but is not
// actually shaped like a completed run.
//
// force is deliberately NOT a parameter here: folding it in would make
// isReadyManifest(existing, true) return false for a manifest that IS
// ready, which lies to the `existing is MediaManifest` type predicate.
// force is the caller's override and belongs at the processMedia call
// site (`!force && isReadyManifest(existing)`), not inside the predicate.
export const isReadyManifest = (
  existing: MediaManifest | MediaFailure | null,
): existing is MediaManifest =>
  existing !== null &&
  existing.status === 'ready' &&
  typeof existing.durationSec === 'number' &&
  (existing.kind === 'audio' || existing.kind === 'video');

// processMedia's outcome, tagged with whether the ready-manifest guard
// short-circuited the run. Always present (never a conditionally-present
// key) so a skipped delivery is distinguishable from a real run instead of
// silently replaying the original run's timings as if they just happened.
export type ProcessMediaResult = MediaManifest & { skipped: boolean };

export const processMedia = async (
  rawKey: string,
  userId: string,
  options: ProcessMediaOptions = {},
): Promise<ProcessMediaResult> => {
  const { force = false } = options;
  const { key, mediaId } = parseOriginalKey(rawKey, userId);
  const { manifest: manifestKey } = derivedKeys(userId, mediaId);

  // Skip the R2 round trip entirely on a deliberate reprocess — force
  // already decides the outcome regardless of what the manifest says.
  const existing = force
    ? null
    : await readManifestIfExists(manifestKey).catch((error: unknown) => {
        // An unreadable manifest must not block processing: the worse
        // failure mode is skipping a job that was never actually done,
        // not the wasted re-run this guard exists to avoid. Only a
        // confirmed 'ready' body may skip.
        console.warn(
          '[media-process] existing manifest read failed — proceeding to reprocess',
          { key, error },
        );
        return null;
      });

  if (!force && isReadyManifest(existing)) {
    console.log('[media-process] ready manifest exists — skipping reprocess', {
      key,
      mediaId,
    });
    return { ...existing, skipped: true };
  }

  const startedAt = Date.now();
  const workDir = await mkdtemp(join(tmpdir(), 'vocabu-media-'));

  try {
    const manifest = await runPipeline(
      key,
      userId,
      mediaId,
      workDir,
      startedAt,
    );
    return { ...manifest, skipped: false };
  } catch (error) {
    // Record the failure where status looks for the result, so clients see
    // a terminal 'failed' instead of polling 'processing' forever. A
    // rejection whose manifest could NOT be persisted must stay retryable:
    // rethrow it as a plain error so the worker 500s and QStash retries,
    // instead of 200-ing a rejection that no manifest records.
    const recorded = await writeFailureManifest(userId, mediaId, key, error);
    if (error instanceof MediaRejection && !recorded) {
      throw new Error(
        `[media-process] rejection not recorded, keeping retry alive: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};
