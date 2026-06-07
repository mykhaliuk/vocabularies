<script setup lang="ts">
import type { NuxtError } from '#app';
import { ArrowLeft, Play } from 'lucide-vue-next';

const props = defineProps<{ error: NuxtError }>();

const is404 = computed(() => props.error.statusCode === 404);

// 404 is rendered as a Vocabu "entry" — a dictionary word that isn't here.
// Other errors borrow the same anatomy but the copy owns up to our side.
const overline = computed(() =>
  is404.value ? 'not in the dictionary' : 'something broke',
);
const word = computed(() =>
  // Non-breaking hyphens keep "four-oh-four" on one line on narrow screens.
  is404.value ? 'four‑oh‑four' : String(props.error.statusCode || 'error'),
);
const gloss = computed(() =>
  is404.value ? "a page that isn't here" : 'we hit a snag on our end',
);
const silentNote = computed(() =>
  is404.value
    ? 'nothing to play — this one was never kept.'
    : 'nothing to play — give it a moment and retry.',
);

useHead({
  title: is404.value ? 'Not found · Vocabu' : 'Something broke · Vocabu',
});

function goHome() {
  clearError({ redirect: '/' });
}

function tryAgain() {
  if (typeof window !== 'undefined') window.location.reload();
}
</script>

<template>
  <main class="notfound">
    <header class="notfound__topbar">
      <div class="notfound__brand">
        <img
          src="/logo-mark.svg"
          alt=""
          width="22"
          height="22"
          class="notfound__mark"
        />
        <span class="notfound__wordmark">Vocabu</span>
      </div>
    </header>

    <section class="notfound__entry">
      <p class="notfound__overline">{{ overline }}</p>

      <h1 class="notfound__word">
        <span class="notfound__quote" aria-hidden="true">“</span>{{ word
        }}<span class="notfound__quote" aria-hidden="true">”</span>
      </h1>

      <p class="notfound__gloss">{{ gloss }}</p>

      <div class="notfound__silent" aria-hidden="true">
        <span class="notfound__play">
          <Play :size="13" fill="currentColor" :stroke-width="0" />
        </span>
        <span class="notfound__line"></span>
        <span class="notfound__cap">—:—</span>
      </div>
      <p class="notfound__silent-note">{{ silentNote }}</p>

      <div class="notfound__actions">
        <VButton variant="primary" size="lg" full @click="goHome">
          <template #left>
            <ArrowLeft :size="18" />
          </template>
          back to your words
        </VButton>
        <VButton
          variant="ghost"
          size="lg"
          full
          @click="is404 ? goHome() : tryAgain()"
        >
          {{ is404 ? 'search your dictionary' : 'try again' }}
        </VButton>
      </div>
    </section>
  </main>
</template>

<style scoped>
.notfound {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  /* Barely-there rose/blue wash — the one decorative exception. color-mix
     re-tints automatically when the theme flips, so no dark-mode override. */
  background:
    radial-gradient(
      118% 70% at 12% -2%,
      color-mix(in oklch, var(--primary) 7%, transparent),
      transparent 52%
    ),
    radial-gradient(
      120% 72% at 92% 104%,
      color-mix(in oklch, var(--secondary) 6%, transparent),
      transparent 54%
    ),
    var(--bg);
}

.notfound__topbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  padding: 0 var(--space-2);
}

.notfound__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.notfound__mark {
  display: block;
  border-radius: var(--r-xs);
}

.notfound__wordmark {
  font-family: var(--font-sans);
  font-size: 21px;
  font-weight: var(--w-bold);
  letter-spacing: -0.03em;
  color: var(--text);
}

.notfound__entry {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 30px calc(var(--space-10) + var(--safe-bottom));
  animation: vfadeup var(--dur-slow) var(--ease-out);
}

.notfound__overline {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: var(--w-bold);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-faint);
  white-space: nowrap;
}

.notfound__word {
  margin: var(--space-3) 0 0;
  font-family: var(--font-hand);
  font-weight: var(--w-semibold);
  font-size: 44px;
  line-height: 1.04;
  letter-spacing: 0;
  color: var(--text);
  white-space: nowrap;
}

.notfound__quote {
  color: var(--text-faint);
  font-weight: var(--w-medium);
}

.notfound__gloss {
  margin: var(--space-3) 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-style: italic;
  color: var(--text-muted);
}

.notfound__silent {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 300px;
  margin: var(--space-5) auto 0;
  opacity: 0.92;
}

.notfound__play {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
  flex: 0 0 auto;
  border: 1.5px solid var(--border-strong);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  justify-content: center;
}

.notfound__line {
  position: relative;
  flex: 1;
  height: 24px;
}

.notfound__line::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  border-radius: 2px;
  transform: translateY(-50%);
  background: repeating-linear-gradient(
    to right,
    var(--border-strong) 0 4px,
    transparent 4px 9px
  );
}

.notfound__cap {
  flex: 0 0 auto;
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: var(--w-medium);
  color: var(--text-faint);
}

.notfound__silent-note {
  margin: var(--space-2) 0 0;
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--text-faint);
}

.notfound__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  max-width: 300px;
  margin-top: var(--space-6);
}

@media (prefers-reduced-motion: reduce) {
  .notfound__entry {
    animation: none;
  }
}
</style>
