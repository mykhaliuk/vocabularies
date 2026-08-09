<script setup lang="ts">
import { ChevronUp, Play, Video } from 'lucide-vue-next';

// The video moment in the feed (media-spec.html §2). Quiet by default: the
// collapsed row keeps the audio player's exact rhythm — play · strip ·
// duration — so a mixed feed holds one vertical rhythm and the word stays the
// loudest thing on the card. Tap expands a framed player inline.
//
// The strip carries a GLYPH, not a poster frame. Product narrowed the
// delivered spec here: no poster means the feed list needs no poster URL and
// the API is untouched. Dropping the real frame in later is a presentation
// change plus a `posterUrl` on the list projection — deferred, not rejected.
//
// `big` is the word-detail variant (word-detail-spec.html §Anatomy step 4):
// the same player with the room a page affords — wider column, larger play
// control, taller frame. Colour does not change; blue stays "media".
const props = withDefaults(
  defineProps<{
    entryId: string;
    durationSec: number | null;
    width: number | null;
    height: number | null;
    variant?: 'inline' | 'big';
  }>(),
  { variant: 'inline' },
);

const { t } = useI18n();
const { resolvePlayback } = useEntryPlayback();

// Both variants' numbers live in utils/media-metrics.ts, where a unit test
// can pin them: a ready player needs MinIO to render, so nothing in CI ever
// looks at this component.
const isBig = computed(() => props.variant === 'big');
const metrics = computed(() => VIDEO_METRICS[props.variant]);
const playGlyphSize = computed(() => metrics.value.playGlyphPx);
const stripGlyphSize = computed(() => metrics.value.stripGlyphPx);
const styleVars = computed(() => videoStyleVars(props.variant));

const expanded = ref(false);
const playing = ref(false);
const failed = ref(false);
const sourceUrl = ref<string | undefined>();
const playedFraction = ref(0);
const elementDurationSec = ref<number | undefined>();

const videoRef = ref<HTMLVideoElement | null>(null);

// Guards the async gap between "resolve the signed URL" and "the element
// exists": without it a second tap during that round-trip starts a second
// resolve and can expand onto a half-built player.
let starting = false;
// Reset in `finally`, so it only stops a loop within one failure — a later
// expiry an hour on is still recoverable.
let retrying = false;

// Portrait fills more height than landscape, but neither may swallow the
// entry. Missing dimensions fall back to landscape, the shorter frame.
const isPortrait = computed(() => {
  const { width, height } = props;
  return width !== null && height !== null && height > width;
});

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

const resolveUrl = async (
  forceRefresh: boolean,
): Promise<string | undefined> => {
  try {
    const playback = await resolvePlayback(props.entryId, forceRefresh);
    return playback?.videoUrl ?? undefined;
  } catch (error) {
    console.error('[FeedVideoPlayer] failed to resolve playback', error);
    return undefined;
  }
};

const onLoadedMetadata = () => {
  const element = videoRef.value;
  if (element && Number.isFinite(element.duration)) {
    elementDurationSec.value = element.duration;
  }
};

const onTimeUpdate = () => {
  const element = videoRef.value;
  if (!element) return;
  const { currentTime, duration } = element;
  playedFraction.value =
    Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0;
};

const onEnded = () => {
  playing.value = false;
  playedFraction.value = 0;
};

// An expired signed URL surfaces as an 'error' event on the element. Refresh
// once and retry before admitting failure.
const onError = async () => {
  const element = videoRef.value;
  if (retrying || !element) {
    playing.value = false;
    return;
  }
  retrying = true;
  try {
    const url = await resolveUrl(true);
    if (!url || !videoRef.value) {
      playing.value = false;
      failed.value = true;
      return;
    }
    sourceUrl.value = url;
    videoRef.value.src = url;
    await videoRef.value.play();
    playing.value = true;
    failed.value = false;
  } catch (error) {
    console.error('[FeedVideoPlayer] retry playback failed', error);
    playing.value = false;
    failed.value = true;
  } finally {
    retrying = false;
  }
};

const expand = async () => {
  if (starting) return;
  starting = true;
  try {
    if (!sourceUrl.value) {
      const url = await resolveUrl(false);
      if (!url) {
        failed.value = true;
        return;
      }
      sourceUrl.value = url;
    }
    expanded.value = true;
    failed.value = false;
    await nextTick();
    const element = videoRef.value;
    if (!element) return;
    await element.play();
    playing.value = true;
  } catch (error) {
    console.error('[FeedVideoPlayer] could not start playback', error);
    playing.value = false;
  } finally {
    starting = false;
  }
};

const toggle = async () => {
  const element = videoRef.value;
  if (!element) return;
  if (element.paused) {
    try {
      await element.play();
      playing.value = true;
    } catch (error) {
      console.error('[FeedVideoPlayer] play failed', error);
    }
  } else {
    element.pause();
    playing.value = false;
  }
};

const collapse = () => {
  videoRef.value?.pause();
  playing.value = false;
  expanded.value = false;
};

onUnmounted(() => {
  videoRef.value?.pause();
});
</script>

<template>
  <div class="video" :class="{ 'video--big': isBig }" :style="styleVars">
    <!-- collapsed: the audio player's rhythm, so the feed keeps one beat -->
    <button
      v-if="!expanded"
      type="button"
      class="video__row"
      :aria-label="t('app.feed.videoPlay')"
      @click="expand"
    >
      <span class="video__play">
        <Play :size="playGlyphSize" aria-hidden="true" />
      </span>
      <span class="video__strip">
        <Video :size="stripGlyphSize" aria-hidden="true" />
      </span>
      <span class="video__dur">{{
        failed ? t('app.feed.playbackUnavailable') : durationLabel
      }}</span>
    </button>

    <!-- expanded: framed inline player, contained so faces are never cropped -->
    <div
      v-else
      class="video__frame"
      :class="isPortrait ? 'video__frame--portrait' : 'video__frame--land'"
    >
      <video
        ref="videoRef"
        :src="sourceUrl"
        class="video__el"
        playsinline
        preload="metadata"
        @click="toggle"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @error="onError"
      />

      <button
        v-if="!playing"
        type="button"
        class="video__badge"
        :aria-label="t('app.feed.videoPlay')"
        @click="toggle"
      >
        <Play :size="22" aria-hidden="true" />
      </button>

      <button
        type="button"
        class="video__chev"
        :aria-label="t('app.feed.videoCollapse')"
        @click="collapse"
      >
        <ChevronUp :size="16" aria-hidden="true" />
      </button>

      <span class="video__prog" aria-hidden="true">
        <i :style="{ width: `${playedFraction * 100}%` }" />
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Every metric that differs between the feed row and the detail page arrives
   as a custom property from utils/media-metrics.ts, so no number below can
   belong to one variant only. The inline variant resolves --video-max-w to
   `none` — it deliberately keeps NO max-width, that is what ships in the
   feed today, and this ticket must not move it. */
.video {
  display: flex;
  flex-direction: column;
  max-width: var(--video-max-w);
}

/* A cross-axis auto margin cancels the flex item's stretch, so the width has
   to be asked for explicitly before the max-width above can centre it. */
.video--big {
  width: 100%;
  margin: 0 auto;
}

/* 36px body inside a 44px tap area — the block the audio player occupies. */
.video__row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: var(--tap-min);
  padding: 4px 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.video__play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--video-btn);
  height: var(--video-btn);
  flex: 0 0 auto;
  border: 1.5px solid var(--blue-300);
  border-radius: var(--r-sm);
  color: var(--secondary);
}
.video__play :deep(svg) {
  fill: currentColor;
  stroke: none;
}

.video__strip {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: var(--video-btn);
  border: 1px solid var(--hairline-2);
  border-radius: var(--r-sm);
  background: var(--surface-sunk);
  color: var(--ink-2);
  overflow: hidden;
}

.video__dur {
  flex: 0 0 auto;
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: var(--w-medium);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.video__frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hairline-2);
  border-radius: var(--r-card);
  background: var(--surface-sunk);
  overflow: hidden;
}
.video__frame--portrait {
  height: var(--video-frame-portrait);
}
.video__frame--land {
  height: var(--video-frame-land);
}

.video__el {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Overlay fills are color-mix of --ink so they hold in both themes. */
.video__badge {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: var(--r-pill);
  background: color-mix(in oklch, var(--ink) 62%, transparent);
  color: var(--paper);
  cursor: pointer;
}
.video__badge :deep(svg) {
  fill: currentColor;
  stroke: none;
}

.video__chev {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--tap-min);
  height: var(--tap-min);
  border: 0;
  border-radius: var(--r-pill);
  background: color-mix(in oklch, var(--ink) 46%, transparent);
  color: var(--paper);
  cursor: pointer;
}

.video__prog {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: color-mix(in oklch, var(--ink) 22%, transparent);
}
.video__prog i {
  display: block;
  height: 100%;
  background: var(--secondary);
  transition: width var(--dur-fast) linear;
}

@media (prefers-reduced-motion: reduce) {
  .video__prog i {
    transition: none;
  }
}
</style>
