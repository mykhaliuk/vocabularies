<script setup lang="ts">
import { Pause, Play } from 'lucide-vue-next';

// `big` is the word-detail variant (word-detail-spec.html §Anatomy step 4):
// the same player, given the room a page has and a feed card does not.
// Colour is identical in both — blue is "media" (media-spec.html §236).
const props = withDefaults(
  defineProps<{
    entryId: string;
    peaks: number[] | null;
    durationSec: number | null;
    variant?: 'inline' | 'big';
  }>(),
  { variant: 'inline' },
);

const { t } = useI18n();
const { resolvePlayback } = useEntryPlayback();

// Both variants' numbers live in utils/media-metrics.ts, where a unit test
// can pin them: a ready player needs MinIO to render, so nothing in CI ever
// looks at this component.
const glyphSize = computed(() => AUDIO_METRICS[props.variant].glyphPx);
const styleVars = computed(() => audioStyleVars(props.variant));

// Number of bars synthesized when the entry has no analysed peaks, so the
// row still reads as an audio waveform rather than an empty strip.
const SYNTH_BAR_COUNT = 40;

// Deterministic 0..1 amplitudes per bar. Real peaks are integers 0..100;
// when absent we derive a stable pseudo-wave from the entry id so the same
// entry always renders the same shape.
const bars = computed<number[]>(() => {
  const { peaks } = props;
  if (peaks && peaks.length > 0) {
    return peaks.map((peak) => Math.min(1, Math.max(0, peak / 100)));
  }
  let seed = 0;
  for (let index = 0; index < props.entryId.length; index++) {
    seed += props.entryId.charCodeAt(index);
  }
  const result: number[] = [];
  for (let index = 0; index < SYNTH_BAR_COUNT; index++) {
    result.push((Math.sin(seed + index * 0.6) + 1) / 2);
  }
  return result;
});

const barHeight = (amplitude: number) => `${16 + amplitude * 84}%`;

// Lazily-created element: audio is only fetched + built on the first play,
// kept as a plain (non-reactive) ref so timeupdate churn does not trigger
// component re-renders beyond the reactive refs below.
let audioEl: HTMLAudioElement | null = null;
// Guards the async gap between "resolve the signed URL" and "assign audioEl":
// without it a second tap during that round-trip builds a second element and
// orphans the first (which keeps playing, unreachable, past unmount).
let starting = false;
let retrying = false;

const playing = ref(false);
const playedFraction = ref(0);
const elementDurationSec = ref<number | undefined>();
const failed = ref(false);

const clipInset = computed(
  () => `inset(0 ${(1 - playedFraction.value) * 100}% 0 0)`,
);

const durationLabel = computed(() => {
  const seconds = props.durationSec ?? elementDurationSec.value;
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
});

const onLoadedMetadata = () => {
  if (audioEl && Number.isFinite(audioEl.duration)) {
    elementDurationSec.value = audioEl.duration;
  }
};

const onTimeUpdate = () => {
  if (!audioEl) return;
  const { currentTime, duration } = audioEl;
  playedFraction.value =
    Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0;
};

const onEnded = () => {
  playing.value = false;
  playedFraction.value = 0;
};

const resolveUrl = async (
  forceRefresh: boolean,
): Promise<string | undefined> => {
  try {
    const playback = await resolvePlayback(props.entryId, forceRefresh);
    return playback?.audioUrl ?? undefined;
  } catch (error) {
    console.error('[FeedAudioPlayer] failed to resolve playback', error);
    return undefined;
  }
};

// Signed playback URLs expire (~1h), which surfaces as an 'error' event on the
// element. Refresh once per failure and retry; `retrying` only guards against
// looping within a single attempt, so a later expiry is still recoverable.
const onError = async () => {
  if (retrying || !audioEl) {
    playing.value = false;
    return;
  }
  retrying = true;
  try {
    const url = await resolveUrl(true);
    if (!url || !audioEl) {
      playing.value = false;
      failed.value = true;
      return;
    }
    audioEl.src = url;
    await audioEl.play();
    playing.value = true;
    failed.value = false;
  } catch (error) {
    console.error('[FeedAudioPlayer] retry playback failed', error);
    playing.value = false;
    failed.value = true;
  } finally {
    retrying = false;
  }
};

const startPlayback = async () => {
  if (starting) return;
  starting = true;
  try {
    if (!audioEl) {
      const url = await resolveUrl(false);
      if (!url) {
        failed.value = true;
        return;
      }
      const element = new Audio(url);
      element.addEventListener('loadedmetadata', onLoadedMetadata);
      element.addEventListener('timeupdate', onTimeUpdate);
      element.addEventListener('ended', onEnded);
      element.addEventListener('error', onError);
      audioEl = element;
    }
    await audioEl.play();
    playing.value = true;
    failed.value = false;
  } catch (error) {
    console.error('[FeedAudioPlayer] playback failed', error);
    playing.value = false;
    failed.value = true;
  } finally {
    starting = false;
  }
};

const toggle = async () => {
  if (playing.value) {
    audioEl?.pause();
    playing.value = false;
    return;
  }
  await startPlayback();
};

onBeforeUnmount(() => {
  if (!audioEl) return;
  audioEl.pause();
  audioEl.removeEventListener('loadedmetadata', onLoadedMetadata);
  audioEl.removeEventListener('timeupdate', onTimeUpdate);
  audioEl.removeEventListener('ended', onEnded);
  audioEl.removeEventListener('error', onError);
  audioEl.src = '';
  audioEl = null;
});
</script>

<template>
  <div class="audio" :style="styleVars">
    <!-- The whole row is the control (as in the prototype), so the tap target
         clears --tap-min even though the glyph box is 38px. -->
    <button
      type="button"
      class="audio__row"
      :aria-label="playing ? t('app.feed.audioPause') : t('app.feed.audioPlay')"
      @click="toggle"
    >
      <span
        class="audio__btn"
        :class="{ 'audio__btn--playing': playing }"
        aria-hidden="true"
      >
        <Pause v-if="playing" :size="glyphSize" :fill="'currentColor'" />
        <Play v-else :size="glyphSize" :fill="'currentColor'" />
      </span>

      <span class="audio__wave">
        <span class="audio__bars" aria-hidden="true">
          <span
            v-for="(amplitude, index) in bars"
            :key="index"
            class="audio__bar"
            :style="{ height: barHeight(amplitude) }"
          />
        </span>
        <span
          class="audio__bars audio__bars--played"
          aria-hidden="true"
          :style="{ clipPath: clipInset }"
        >
          <span
            v-for="(amplitude, index) in bars"
            :key="index"
            class="audio__bar audio__bar--played"
            :style="{ height: barHeight(amplitude) }"
          />
        </span>
      </span>

      <span class="audio__time">{{ durationLabel }}</span>
    </button>

    <p v-if="failed" class="audio__failed" role="status">
      {{ t('app.feed.playbackUnavailable') }}
    </p>
  </div>
</template>

<style scoped>
/* Every metric that differs between the feed row and the detail page arrives
   as a custom property from utils/media-metrics.ts, so no number below can
   belong to one variant only. */
.audio {
  width: 100%;
  max-width: var(--audio-max-w);
  margin: 0 auto;
}

.audio__row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: var(--tap-min);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:active .audio__btn {
    transform: scale(0.96);
  }
}

/* Rounded rect, not a pill — buttons carry --r-btn per the brand rules. */
.audio__btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--audio-btn);
  height: var(--audio-btn);
  border: 1.5px solid var(--blue-300);
  border-radius: var(--r-btn);
  background: transparent;
  color: var(--secondary);
  transition:
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.audio__btn--playing {
  background: var(--secondary-soft);
}

.audio__wave {
  position: relative;
  flex: 1;
  height: var(--audio-wave-h);
  overflow: hidden;
}

.audio__bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 3px;
}

/* Overlay shares the base layer's exact box + bar geometry, so clipping it
   from the right reveals a perfectly aligned "played" tint. clip-path (vs a
   shrinking width) keeps the bars fixed instead of squashing them. */
.audio__bars--played {
  transition: clip-path var(--dur-base) linear;
}

/* --blue-100 (not -200) for the untouched track: the DS re-themes the -50/-100
   steps for dark but deliberately leaves -200 at its light value, which would
   make the unplayed bars outshine the played ones on a dark canvas. */
.audio__bar {
  flex: 1;
  min-width: 2px;
  border-radius: 3px;
  background: var(--blue-100);
}

.audio__bar--played {
  background: var(--secondary);
}

.audio__failed {
  margin: 8px 0 0;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
}

.audio__time {
  flex: 0 0 auto;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .audio__btn,
  .audio__bars--played {
    transition: none;
  }
}
</style>
