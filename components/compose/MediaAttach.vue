<script setup lang="ts">
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  Repeat,
  RefreshCw,
  Upload,
  Video,
  X,
} from 'lucide-vue-next';
import type { ComposePhase } from '~/composables/useMediaUpload';
import type { Entitlements } from '~/server/utils/entitlements';
import { ALLOWED_MEDIA_CONTENT_TYPES } from '~/shared/media-types';

// The media affordance (docs/design/prototype/project/Vocabu/media-spec.html).
// Tier decides the shape: premium gets one combined control that infers the
// kind from the file; everyone else gets the voice path plus a visibly locked
// video affordance, because a gate folded into a combined control would only
// ever surface as a failure after the fact.
//
// Every lock here is presentation. The server is the gate: a bypassed control
// still lands on 403 VIDEO_UPLOAD_FORBIDDEN, which is why the failed state
// below has a branch for it rather than a dead end.
const props = defineProps<{
  file: File | null;
  phase: ComposePhase;
  progress: number;
  entitlements: Entitlements | null;
  errorCode: string | undefined;
  errorMessage: string | undefined;
}>();

const emit = defineEmits<{
  'update:file': [File | null];
  retry: [];
  reset: [];
  'see-premium': [];
}>();

const { t } = useI18n();

// The same roster POST /api/entries validates against (shared/media-types).
// Anything outside it would be rejected with a bare validation error, so
// catch it here and say something a person can act on.
const ALLOWED_TYPES: ReadonlySet<string> = new Set(ALLOWED_MEDIA_CONTENT_TYPES);

// Kind inference for files that already passed the roster gate, so the MIME
// type is always present and decides alone.
const isVideoFile = (file: File): boolean => file.type.startsWith('video/');

const canUploadVideo = computed(() => props.entitlements?.videoUpload === true);
const limits = computed(() => props.entitlements);

const inputRef = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const localError = ref<string | undefined>();

const selectedIsVideo = computed(() =>
  props.file ? isVideoFile(props.file) : false,
);

// "3 min" reads better than "180 s"; anything under a minute stays in seconds.
const durationLabel = (seconds: number): string =>
  seconds >= 60 && seconds % 60 === 0
    ? t('app.compose.media.minutes', { n: seconds / 60 })
    : t('app.compose.media.seconds', { n: seconds });

const audioLimitLabel = computed(() =>
  limits.value ? durationLabel(limits.value.maxAudioDurationSec) : '',
);
const videoLimitLabel = computed(() =>
  limits.value ? durationLabel(limits.value.maxVideoDurationSec) : '',
);

// MP4-family containers state their duration in moov/mvhd regardless of the
// codec, so they get a byte-level read FIRST: the media-element probe below
// goes blind exactly when the codec is undecodable (ALAC in .m4a fires
// `error`), which used to fail open and ship a too-long file to the server.
const MP4_FAMILY_TYPES = new Set([
  'audio/mp4',
  'audio/x-m4a',
  'audio/3gpp',
  'video/mp4',
  'video/quicktime',
  'video/3gpp',
]);

const isMp4Family = (file: File): boolean => MP4_FAMILY_TYPES.has(file.type);

// Best-effort client-side duration guard, mirroring the server's caps so a
// client rejection reads exactly like a server rejection. Resolves true when
// the container is unreadable — the server still checks.
const probeElementDuration = (file: File, limitSec: number) =>
  new Promise<boolean>((resolve) => {
    const element = document.createElement(
      isVideoFile(file) ? 'video' : 'audio',
    );
    const url = URL.createObjectURL(file);
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      element.removeAttribute('src');
      resolve(ok);
    };
    const timer = setTimeout(() => done(true), 3000);
    element.preload = 'metadata';
    element.addEventListener('loadedmetadata', () => {
      clearTimeout(timer);
      done(
        !Number.isFinite(element.duration) || element.duration <= limitSec + 1,
      );
    });
    element.addEventListener('error', () => {
      clearTimeout(timer);
      done(true);
    });
    element.src = url;
  });

const withinDuration = async (
  file: File,
  limitSec: number,
): Promise<boolean> => {
  if (isMp4Family(file)) {
    const containerSec = await readMp4DurationSec(file);
    if (containerSec !== null) return containerSec <= limitSec + 1;
  }
  return probeElementDuration(file, limitSec);
};

const accept = async (file: File | undefined) => {
  if (!file) return;
  localError.value = undefined;

  // Strict roster gate: the server requires a contentType from the same
  // roster, so anything outside it (including an empty type from an odd
  // picker) would only die later as a bare 400 — say it here instead.
  if (!ALLOWED_TYPES.has(file.type)) {
    localError.value = t('app.compose.media.invalidType');
    return;
  }

  // Without entitlements we cannot state a limit we are sure of, so the local
  // guards are skipped rather than guessed. The server still enforces both.
  const caps = limits.value;
  if (caps) {
    if (file.size > caps.maxUploadBytes) {
      localError.value = t('app.compose.media.tooBig');
      return;
    }
    const limitSec = isVideoFile(file)
      ? caps.maxVideoDurationSec
      : caps.maxAudioDurationSec;
    if (!(await withinDuration(file, limitSec))) {
      localError.value = t('app.compose.media.tooLong', {
        video: durationLabel(caps.maxVideoDurationSec),
        audio: durationLabel(caps.maxAudioDurationSec),
      });
      return;
    }
  }

  emit('update:file', file);
};

const onPick = (event: Event) => {
  const input = event.target as HTMLInputElement;
  void accept(input.files?.[0]);
  input.value = '';
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  dragging.value = false;
  void accept(event.dataTransfer?.files?.[0]);
};

const openPicker = () => inputRef.value?.click();

// Drops the failed attempt entirely — clears the file AND the upload state, so
// the next pick starts a fresh sequence instead of resuming the old slot.
const chooseAnother = () => {
  localError.value = undefined;
  emit('update:file', null);
  emit('reset');
  void nextTick(openPicker);
};

const clearFile = () => {
  localError.value = undefined;
  emit('update:file', null);
};

const isUploading = computed(
  () => props.phase === 'creating' || props.phase === 'uploading',
);
const isFinalizing = computed(() => props.phase === 'finalizing');
const isBusy = computed(() => isUploading.value || isFinalizing.value);
const isEntitlementFailure = computed(
  () => props.errorCode === 'VIDEO_UPLOAD_FORBIDDEN',
);
// A failure belongs to this panel only when media was actually involved. The
// entitlement rejection counts even without a file still held, since it IS the
// media verdict.
const isMediaFailure = computed(
  () =>
    props.phase === 'error' &&
    (props.file !== null || isEntitlementFailure.value),
);

// Only free users can be offered the picker without video; premium's combined
// control accepts both. While entitlements are unresolved the filter stays
// wide open — narrowing it would GUESS a tier and block a premium user's
// video pick; the guards are skipped, and the server stays the gate.
const acceptAttribute = computed(() => {
  if (limits.value === null) return 'audio/*,video/*';
  return canUploadVideo.value ? 'audio/*,video/*' : 'audio/*';
});

// A static bar field that reads as a waveform while bytes move. Heights are
// deterministic (no Math.random, so SSR and client agree) and the lit count
// tracks progress left to right.
const BAR_COUNT = 32;
const bars = Array.from({ length: BAR_COUNT }, (_, index) =>
  Math.round(16 + Math.abs(Math.sin(index * 1.7 + 3)) * 84),
);
const litBars = computed(() => Math.round((props.progress / 100) * BAR_COUNT));
</script>

<template>
  <div class="attach">
    <!-- failed: one plain-language line, then a way forward. The entitlement
         branch offers premium instead of a retry that cannot succeed. Only
         MEDIA failures land here — a form-level error has no file and belongs
         to the sheet, not to this panel. -->
    <div v-if="isMediaFailure || localError" class="attach__panel">
      <div class="attach__fail">
        <AlertCircle :size="17" class="attach__fail-icon" aria-hidden="true" />
        <p class="attach__fail-text">
          <b class="attach__fail-title">
            {{
              localError
                ? localError
                : isEntitlementFailure
                  ? t('app.compose.media.failVideoTitle')
                  : t('app.compose.media.failTitle')
            }}
          </b>
          <span v-if="!localError">
            {{
              isEntitlementFailure
                ? t('app.compose.media.failVideoBody')
                : (errorMessage ?? t('app.compose.media.failBody'))
            }}
          </span>
        </p>
      </div>
      <div class="attach__acts">
        <VButton
          v-if="isEntitlementFailure"
          variant="secondary"
          size="sm"
          @click="emit('see-premium')"
        >
          <template #left><Lock :size="15" /></template>
          {{ t('app.compose.media.seePremium') }}
        </VButton>
        <VButton
          v-else-if="!localError"
          variant="secondary"
          size="sm"
          @click="emit('retry')"
        >
          <template #left><RefreshCw :size="15" /></template>
          {{ t('app.compose.media.tryAgain') }}
        </VButton>
        <button type="button" class="attach__outline" @click="chooseAnother">
          {{ t('app.compose.media.chooseAnother') }}
        </button>
      </div>
    </div>

    <!-- uploading / normalizing: filename and percentage, then the kind's own
         progress body — bars for a voice clip, a framed strip for a video. -->
    <div v-else-if="file && isBusy" class="attach__panel">
      <div class="attach__head">
        <Upload v-if="isUploading" :size="15" aria-hidden="true" />
        <Loader2 v-else :size="15" class="attach__spin" aria-hidden="true" />
        <span class="attach__head-label">
          {{
            isFinalizing
              ? t('app.compose.media.normalizing')
              : t('app.compose.media.uploadingFile', { name: file.name })
          }}
        </span>
        <span v-if="isUploading" class="attach__pct">{{ progress }}%</span>
      </div>

      <div v-if="selectedIsVideo" class="attach__poster attach__poster--tall">
        <Video :size="15" aria-hidden="true" />
        <span v-if="isUploading" class="attach__prog" aria-hidden="true">
          <i :style="{ width: `${progress}%` }" />
        </span>
      </div>
      <div v-else-if="isUploading" class="attach__wave" aria-hidden="true">
        <i
          v-for="(height, index) in bars"
          :key="index"
          :class="{ 'attach__wave-lit': index < litBars }"
          :style="{ height: `${height}%` }"
        />
      </div>
    </div>

    <!-- attached and waiting for Keep: confirm what is held, offer a swap -->
    <div v-else-if="file" class="attach__panel">
      <div class="attach__kept">
        <span class="attach__tick" aria-hidden="true"
          ><Check :size="11"
        /></span>
        <span class="attach__kept-label">
          {{
            selectedIsVideo
              ? t('app.compose.media.keptVideo')
              : t('app.compose.media.keptVoice')
          }}
        </span>
        <button type="button" class="attach__replace" @click="openPicker">
          <Repeat :size="14" aria-hidden="true" />
          {{ t('app.compose.media.replace') }}
        </button>
      </div>
      <div class="attach__row">
        <span class="attach__name">{{ file.name }}</span>
        <button
          type="button"
          class="attach__remove"
          :aria-label="t('app.compose.media.remove')"
          @click="clearFile"
        >
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- idle: the dropzone. Premium accepts either kind; everyone else gets
         the voice path with the video gate stated before it can be hit. -->
    <div v-else class="attach__panel">
      <button
        type="button"
        class="attach__zone"
        :class="{ 'attach__zone--drag': dragging }"
        @click="openPicker"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <span class="attach__badge"><Upload :size="22" /></span>
        <span class="attach__title">
          {{
            canUploadVideo
              ? t('app.compose.media.ctaCombined')
              : t('app.compose.media.ctaAudio')
          }}
        </span>
        <span v-if="limits" class="attach__hint">
          {{
            canUploadVideo
              ? t('app.compose.media.hintCombined', {
                  audio: audioLimitLabel,
                  video: videoLimitLabel,
                })
              : t('app.compose.media.hintAudio', { audio: audioLimitLabel })
          }}
        </span>
      </button>

      <button
        v-if="entitlements && !canUploadVideo"
        type="button"
        class="attach__note"
        @click="emit('see-premium')"
      >
        <Lock :size="13" aria-hidden="true" />
        {{ t('app.compose.media.lockedNote') }}
        <b>{{ t('app.compose.media.seePremium') }}</b>
      </button>
    </div>

    <input
      ref="inputRef"
      type="file"
      :accept="acceptAttribute"
      class="attach__input"
      @change="onPick"
    />
  </div>
</template>

<style scoped>
.attach {
  margin-top: 18px;
}

/* Blue is the media accent throughout, so audio and video read as siblings. */
.attach__panel {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid var(--blue-100);
  border-radius: var(--r-md);
  background: var(--secondary-soft);
}

.attach__zone {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 22px 16px;
  border: 1.5px dashed var(--blue-200);
  border-radius: var(--r-sm);
  background: transparent;
  cursor: pointer;
  text-align: center;
  transition:
    border-color var(--dur-fast),
    background var(--dur-fast);
}
.attach__zone--drag {
  border-color: var(--secondary);
  background: var(--secondary-soft);
}

.attach__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--r-pill);
  background: var(--secondary);
  color: var(--text-on-accent);
}

.attach__title {
  font-family: var(--font-sans);
  font-size: 14.5px;
  font-weight: var(--w-semibold);
  color: var(--ink);
}
.attach__hint {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
  color: var(--ink-3);
}

/* The locked video affordance for a free plan: legible at rest, no hover
   needed, and it is the carrot — never hidden. */
.attach__note {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: var(--tap-min);
  margin-top: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 12.5px;
  color: var(--ink-3);
  text-align: left;
}
.attach__note b {
  margin-left: auto;
  font-size: 12.5px;
  font-weight: var(--w-semibold);
  color: var(--link);
}

.attach__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: var(--w-semibold);
  color: var(--ink-2);
}
.attach__head svg {
  color: var(--secondary);
  flex: 0 0 auto;
}
.attach__head-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attach__pct {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--secondary);
  font-variant-numeric: tabular-nums;
}
.attach__spin {
  animation: vspin 0.8s linear infinite;
}

.attach__wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 44px;
}
.attach__wave i {
  flex: 1;
  min-width: 2px;
  border-radius: 3px;
  background: var(--blue-200);
  align-self: center;
  transition: background var(--dur-fast);
}
.attach__wave-lit {
  background: var(--secondary) !important;
}

/* Video has no waveform to show, so the strip stands in for the frame. */
.attach__poster {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: var(--r-sm);
  border: 1px solid var(--hairline-2);
  background: var(--surface-sunk);
  color: var(--ink-2);
  overflow: hidden;
}
.attach__poster--tall {
  height: 64px;
}

.attach__prog {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: var(--blue-100);
}
.attach__prog i {
  display: block;
  height: 100%;
  background: var(--secondary);
  transition: width var(--dur-fast) linear;
}

.attach__kept {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
}
.attach__tick {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: var(--r-pill);
  background: var(--secondary);
  color: var(--text-on-accent);
}
.attach__kept-label {
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: var(--w-semibold);
  color: var(--ink-2);
}
.attach__replace {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: var(--tap-min);
  padding: 0 2px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: var(--w-semibold);
  color: var(--ink-3);
}

.attach__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.attach__name {
  flex: 1;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: var(--w-medium);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attach__remove {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
}

.attach__fail {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in oklch, var(--danger) 26%, transparent);
  border-radius: var(--r-sm);
  background: var(--danger-bg);
}
.attach__fail-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--danger);
}
.attach__fail-text {
  flex: 1;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--ink-2);
}
.attach__fail-title {
  display: block;
  margin-bottom: 3px;
  font-size: 14px;
  font-weight: var(--w-semibold);
  color: var(--ink);
}

.attach__acts {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.attach__outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--tap-min);
  padding: 0 13px;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-btn);
  background: var(--surface);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: var(--w-semibold);
  color: var(--ink);
}

.attach__input {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .attach__spin {
    animation: none;
  }
  .attach__prog i,
  .attach__wave i {
    transition: none;
  }
}
</style>
