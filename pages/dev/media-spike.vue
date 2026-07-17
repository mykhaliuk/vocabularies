<script setup>
// VKB-63 spike page: bare-bones upload → processing → playback loop.
// Throwaway UI — no design, tokens only where color is unavoidable.

/** @type {import('vue').Ref<File | null>} */
const file = ref(null);
const phase = ref('idle'); // idle | uploading | processing | ready | error
const progress = ref(0);
const error = ref('');
/** @type {import('vue').Ref<any>} */
const result = ref(null);
const mediaId = ref('');

/** @param {Event} event */
const onPick = (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  file.value = input.files?.[0] ?? null;
  phase.value = 'idle';
  error.value = '';
  result.value = null;
};

/**
 * @param {string} url
 * @param {File} blob
 * @param {string} contentType
 * @returns {Promise<void>}
 */
const putWithProgress = (url, blob, contentType) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable)
        progress.value = Math.round((e.loaded / e.total) * 100);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status < 300) resolve();
      else reject(new Error(`PUT ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('PUT network error')));
    xhr.send(blob);
  });

const poll = async () => {
  for (let i = 0; i < 150; i++) {
    const status = await $fetch('/api/media/status', {
      query: { mediaId: mediaId.value },
    });
    if (status.status === 'ready') {
      result.value = status;
      phase.value = 'ready';
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('processing timed out (5 min)');
};

const run = async () => {
  if (!file.value) return;
  error.value = '';
  result.value = null;
  progress.value = 0;
  try {
    phase.value = 'uploading';
    const contentType = file.value.type || 'application/octet-stream';
    const slot = await $fetch('/api/media/upload', {
      method: 'POST',
      body: { contentType, sizeBytes: file.value.size },
    });
    mediaId.value = slot.mediaId;
    await putWithProgress(slot.uploadUrl, file.value, contentType);
    phase.value = 'processing';
    const confirmed = await $fetch('/api/media/confirm', {
      method: 'POST',
      body: { key: slot.key },
    });
    console.log('[spike] transport:', confirmed.transport);
    await poll();
  } catch (caught) {
    const data = /** @type {{ data?: { statusMessage?: string } }} */ (caught);
    error.value = data?.data?.statusMessage ?? String(caught);
    phase.value = 'error';
  }
};
</script>

<template>
  <main class="spike">
    <h1>Media pipeline spike</h1>
    <p>VKB-63 — upload a ≤20s audio/video file, watch it come back playable.</p>

    <input type="file" accept="audio/*,video/*" @change="onPick" />
    <button
      :disabled="!file || phase === 'uploading' || phase === 'processing'"
      @click="run"
    >
      Upload & process
    </button>

    <p v-if="phase === 'uploading'">Uploading… {{ progress }}%</p>
    <p v-if="phase === 'processing'">Processing…</p>
    <p v-if="phase === 'error'" class="error">{{ error }}</p>

    <section v-if="result">
      <h2>
        {{ result.manifest.kind }} ·
        {{ result.manifest.durationSec.toFixed(1) }}s
      </h2>

      <video
        v-if="result.videoUrl"
        :src="result.videoUrl"
        :poster="result.posterUrl"
        controls
        playsinline
        class="player"
      />
      <audio v-else-if="result.audioUrl" :src="result.audioUrl" controls />

      <div v-if="result.manifest.peaks" class="peaks">
        <span
          v-for="(peak, index) in result.manifest.peaks"
          :key="index"
          :style="{ height: `${Math.max(peak, 4)}%` }"
        />
      </div>

      <table>
        <tbody>
          <tr v-for="(value, name) in result.manifest.timings" :key="name">
            <td>{{ name }}</td>
            <td>{{ value }} ms</td>
          </tr>
          <tr>
            <td>source</td>
            <td>
              {{ (result.manifest.sourceBytes / 1048576).toFixed(1) }} MB ·
              {{ result.manifest.sourceCodecs.join(', ') }}
            </td>
          </tr>
          <tr v-if="result.manifest.width">
            <td>derivative</td>
            <td>{{ result.manifest.width }}×{{ result.manifest.height }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.spike {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.error {
  color: var(--rose-600);
}

.player {
  max-width: 100%;
  border-radius: 14px;
}

.peaks {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  height: 48px;
}

.peaks span {
  flex: 1;
  background: var(--rose-500);
  border-radius: 1px;
}

table td {
  padding: 2px 12px 2px 0;
  font-variant-numeric: tabular-nums;
}
</style>
