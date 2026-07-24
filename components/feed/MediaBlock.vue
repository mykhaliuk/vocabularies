<script setup lang="ts">
import { Video } from 'lucide-vue-next';

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

defineProps<{
  media: FeedMedia | null;
  entryId: string;
}>();
</script>

<template>
  <div v-if="media" class="media-block">
    <!-- processing: soft pulsing indicator while the upload normalizes -->
    <p v-if="media.status === 'processing'" class="media-block__note">
      <span class="media-block__pulse" aria-hidden="true" />
      {{ $t('app.feed.processing') }}
    </p>

    <!-- failed: terse reason, optional server detail on a muted sub-line -->
    <div v-else-if="media.status === 'failed'" class="media-block__failed">
      <p class="media-block__failed-text">{{ $t('app.feed.failed') }}</p>
      <p v-if="media.error" class="media-block__failed-detail">
        {{ media.error }}
      </p>
    </div>

    <!-- ready audio: the real waveform player -->
    <FeedAudioPlayer
      v-else-if="media.status === 'ready' && media.kind === 'audio'"
      :entry-id="entryId"
      :peaks="media.peaks"
      :duration-sec="media.durationSec"
    />

    <!-- ready video: provisional neutral card — real playback lands with the
         media-affordance design round (docs/design/proposals/2026-07-24). -->
    <div
      v-else-if="media.status === 'ready' && media.kind === 'video'"
      class="media-block__video"
    >
      <Video :size="22" aria-hidden="true" />
      <span class="media-block__video-text">{{
        $t('app.feed.videoPending')
      }}</span>
    </div>
  </div>
</template>

<style scoped>
.media-block {
  display: flex;
  flex-direction: column;
}

.media-block__note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 6px 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
}

.media-block__pulse {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: var(--r-pill);
  background: currentColor;
  animation: media-block-pulse 1400ms var(--ease-in-out) infinite;
}

.media-block__failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  text-align: center;
}

.media-block__failed-text {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--danger);
}

.media-block__failed-detail {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-3);
}

.media-block__video {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-card);
  background: var(--surface-sunk);
  color: var(--ink-3);
  text-align: center;
}

.media-block__video-text {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
}

@keyframes media-block-pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .media-block__pulse {
    animation: none;
  }
}
</style>
