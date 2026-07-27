<script setup lang="ts">
import { Sparkles, Video } from 'lucide-vue-next';

// The upsell behind every locked video affordance (media-spec.html §1).
// Gentle and explicit: it names what premium adds and offers one way on.
//
// No plans screen exists yet, so "see premium" does not navigate — it swaps
// this sheet to a "coming soon" line in place. A CTA that routes nowhere is
// worse than one that answers honestly, and product settled on no pricing and
// no billing copy here.
const props = defineProps<{
  open: boolean;
  videoLimitLabel: string;
}>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const stage = ref<'pitch' | 'soon'>('pitch');

// Each opening starts from the pitch; a sheet that reopens on the last screen
// would hide the reason it exists.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) stage.value = 'pitch';
  },
);

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) {
    event.stopPropagation();
    emit('close');
  }
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="upsell">
      <div class="upsell__scrim" @click="emit('close')" />
      <div
        class="upsell__sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'upsell-title'"
      >
        <span class="upsell__icon" aria-hidden="true">
          <Video v-if="stage === 'pitch'" :size="24" />
          <Sparkles v-else :size="24" />
        </span>

        <h2 id="upsell-title" class="upsell__title">
          {{
            stage === 'pitch'
              ? t('app.compose.premium.title')
              : t('app.compose.premium.soonTitle')
          }}
        </h2>
        <!-- The limit comes from entitlements; when they have not resolved the
             copy drops the number rather than inventing one. -->
        <p class="upsell__body">
          {{
            stage === 'soon'
              ? t('app.compose.premium.soonBody')
              : videoLimitLabel
                ? t('app.compose.premium.body', { seconds: videoLimitLabel })
                : t('app.compose.premium.bodyPlain')
          }}
        </p>

        <VButton
          v-if="stage === 'pitch'"
          full
          size="lg"
          class="upsell__cta"
          @click="stage = 'soon'"
        >
          {{ t('app.compose.premium.cta') }}
        </VButton>

        <button type="button" class="upsell__ghost" @click="emit('close')">
          {{
            stage === 'pitch'
              ? t('app.compose.premium.dismiss')
              : t('app.compose.premium.close')
          }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.upsell {
  position: fixed;
  inset: 0;
  /* Above the compose sheet (z-index 60), not level with it: teleporting to
     body only wins the tie when the z-index differs, so at 60 the sheet stayed
     visible but every click landed on .compose__body behind it. */
  z-index: 70;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.upsell__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
}

.upsell__sheet {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: 26px 22px calc(18px + var(--safe-bottom));
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  text-align: center;
  animation: upsell-rise var(--dur-slow) var(--ease-out);
}

/* Rose stays with the primary action and the upsell icon — the one place the
   media surfaces step away from blue. */
.upsell__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  margin-bottom: 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--primary-soft-border);
  background: var(--primary-soft);
  color: var(--primary);
}

.upsell__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 20px;
  font-weight: var(--w-semibold);
  letter-spacing: -0.02em;
  color: var(--ink);
}

.upsell__body {
  margin: 9px auto 0;
  max-width: 285px;
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

.upsell__cta {
  margin-top: 20px;
}

.upsell__ghost {
  width: 100%;
  min-height: var(--tap-min);
  margin-top: 4px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14.5px;
  color: var(--ink-3);
}

@keyframes upsell-rise {
  from {
    transform: translateY(14px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .upsell__sheet {
    animation: none;
  }
}
</style>
