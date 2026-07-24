<script setup lang="ts">
import { Pause, Play } from 'lucide-vue-next';

const props = defineProps<{
  entryId: string;
  peaks: number[] | null;
  durationSec: number | null;
}>();

const { t } = useI18n();
const { resolvePlayback } = useEntryPlayback();

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
// component re-renders beyond the two reactive refs below.
let audioEl: HTMLAudioElement | null = null;
let hasRetried = false;

const playing = ref(false);
const playedFraction = ref(0);
const elementDurationSec = ref<number | null>(null);

const clipInset = computed(
  () => `inset(0 ${(1 - playedFraction.value) * 100}% 0 0)`,
);

const durationLabel = computed(() => {
  const seconds = props.durationSec ?? elementDurationSec.value;
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
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

const resolveUrl = async (forceRefresh: boolean): Promise<string | null> => {
  try {
    const playback = await resolvePlayback(props.entryId, forceRefresh);
    return playback?.audioUrl ?? null;
  } catch (error) {
    console.error('[FeedAudioPlayer] failed to resolve playback', error);
    return null;
  }
};

// A stale/expired signed URL surfaces as an 'error' event: refresh it once
// and retry, then give up so a genuinely broken source cannot loop.
const onError = async () => {
  if (hasRetried || !audioEl) {
    playing.value = false;
    return;
  }
  hasRetried = true;
  const url = await resolveUrl(true);
  if (!url) {
    playing.value = false;
    return;
  }
  audioEl.src = url;
  try {
    await audioEl.play();
    playing.value = true;
  } catch (error) {
    console.error('[FeedAudioPlayer] retry playback failed', error);
    playing.value = false;
  }
};

const startPlayback = async () => {
  if (!audioEl) {
    const url = await resolveUrl(false);
    if (!url) return;
    audioEl = new Audio(url);
    audioEl.addEventListener('loadedmetadata', onLoadedMetadata);
    audioEl.addEventListener('timeupdate', onTimeUpdate);
    audioEl.addEventListener('ended', onEnded);
    audioEl.addEventListener('error', onError);
  }
  try {
    await audioEl.play();
    playing.value = true;
  } catch (error) {
    console.error('[FeedAudioPlayer] playback failed', error);
    playing.value = false;
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
  <div class="audio">
    <button
      type="button"
      class="audio__btn"
      :class="{ 'audio__btn--playing': playing }"
      :aria-label="playing ? t('app.feed.audioPause') : t('app.feed.audioPlay')"
      @click="toggle"
    >
      <Pause v-if="playing" :size="16" :fill="'currentColor'" />
      <Play v-else :size="16" :fill="'currentColor'" />
    </button>

    <div class="audio__wave">
      <div class="audio__bars" aria-hidden="true">
        <span
          v-for="(amplitude, index) in bars"
          :key="index"
          class="audio__bar"
          :style="{ height: barHeight(amplitude) }"
        />
      </div>
      <div
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
      </div>
    </div>

    <span class="audio__time">{{ durationLabel }}</span>
  </div>
</template>

<style scoped>
.audio {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
}

.audio__btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1.5px solid var(--blue-300);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--secondary);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);

  &:active {
    transform: scale(0.96);
  }
}

.audio__btn--playing {
  background: var(--secondary-soft);
}

.audio__wave {
  position: relative;
  flex: 1;
  height: 24px;
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

.audio__bar {
  flex: 1;
  min-width: 2px;
  border-radius: 3px;
  background: var(--blue-200);
}

.audio__bar--played {
  background: var(--secondary);
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
