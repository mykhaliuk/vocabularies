<script setup lang="ts">
import { AlertCircle, Loader2, Mic, Video } from 'lucide-vue-next';

type FeedMedia = {
  mediaId: string;
  kind: 'audio' | 'video';
  status: 'processing' | 'ready' | 'failed';
  durationSec: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
  error: string | null;
};

// `variant` only reaches the ready players: the transient processing and
// failed rows below are the same size everywhere, because they are a status
// line rather than a thing you look at.
const props = withDefaults(
  defineProps<{
    media: FeedMedia | null;
    entryId: string;
    variant?: 'inline' | 'big';
  }>(),
  { variant: 'inline' },
);

const isVideo = computed(() => props.media?.kind === 'video');
</script>

<template>
  <div v-if="media" class="media-block">
    <!-- processing: the collapsed row's shape, with a spinner where the play
         control will be. No play affordance is offered until it is real. -->
    <div v-if="media.status === 'processing'" class="media-block__row">
      <span class="media-block__slot">
        <Loader2 :size="14" class="media-block__spin" aria-hidden="true" />
      </span>
      <span class="media-block__strip">
        <Video v-if="isVideo" :size="15" aria-hidden="true" />
        <Mic v-else :size="15" aria-hidden="true" />
      </span>
      <span class="media-block__dur">{{ $t('app.feed.normalizing') }}</span>
    </div>

    <!-- failed: one warm line, no error codes. There is deliberately no retry
         control: a failed row is terminal server-side (recordMediaFailure), so
         the only real way forward is a fresh upload. -->
    <div v-else-if="media.status === 'failed'" class="media-block__failed">
      <AlertCircle :size="17" aria-hidden="true" />
      <p class="media-block__failed-text">
        {{ isVideo ? $t('app.feed.videoFailed') : $t('app.feed.failed') }}
      </p>
    </div>

    <!-- ready audio: the real waveform player -->
    <FeedAudioPlayer
      v-else-if="media.status === 'ready' && !isVideo"
      :entry-id="entryId"
      :peaks="media.peaks"
      :duration-sec="media.durationSec"
      :variant="variant"
    />

    <!-- ready video: collapsed row that expands into an inline frame -->
    <FeedVideoPlayer
      v-else-if="media.status === 'ready'"
      :entry-id="entryId"
      :duration-sec="media.durationSec"
      :width="media.width"
      :height="media.height"
      :variant="variant"
    />
  </div>
</template>

<style scoped>
.media-block {
  display: flex;
  flex-direction: column;
}

.media-block__row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: var(--tap-min);
  padding: 4px 0;
}

.media-block__slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-sm);
  color: var(--ink-3);
}

.media-block__spin {
  animation: vspin 0.8s linear infinite;
}

.media-block__strip {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 36px;
  border: 1px solid var(--hairline-2);
  border-radius: var(--r-sm);
  background: var(--surface-sunk);
  color: var(--ink-2);
  overflow: hidden;
}

.media-block__dur {
  flex: 0 0 auto;
  font-family: var(--font-sans);
  font-size: 12.5px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.media-block__failed {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in oklch, var(--danger) 26%, transparent);
  border-radius: var(--r-sm);
  background: var(--danger-bg);
  color: var(--danger);
}

.media-block__failed-text {
  flex: 1;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .media-block__spin {
    animation: none;
  }
}
</style>
