<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';

type Variant = 'primary' | 'blue' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    full?: boolean;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    // When set, the component renders as <a> instead of <button> so the
    // caller never has to nest <button> inside <a> (invalid HTML).
    href?: string;
    target?: '_self' | '_blank';
  }>(),
  {
    variant: 'primary',
    size: 'md',
    full: false,
    loading: false,
    disabled: false,
    type: 'button',
    href: undefined,
    target: undefined,
  },
);

const isAnchor = computed(() => typeof props.href === 'string');
const isInert = computed(() => props.disabled || props.loading);
const spinnerSize = computed(() =>
  props.size === 'sm' ? 16 : props.size === 'lg' ? 18 : 17,
);

// Anchors with target="_blank" need rel to suppress the historical
// window.opener / referrer-leak vectors. Always force both, harmless otherwise.
const anchorRel = computed(() =>
  props.target === '_blank' ? 'noopener noreferrer' : undefined,
);
</script>

<template>
  <component
    :is="isAnchor ? 'a' : 'button'"
    v-bind="
      isAnchor
        ? {
            // Drop href when inert so keyboard Enter / Space can't navigate
            // (pointer-events: none only stops mouse / touch).
            href: isInert ? undefined : href,
            target,
            rel: anchorRel,
            tabindex: isInert ? -1 : undefined,
            'aria-disabled': isInert || undefined,
          }
        : { type, disabled: isInert }
    "
    :class="[
      'v-btn',
      `v-btn--${variant}`,
      `v-btn--${size}`,
      { 'v-btn--full': full, 'v-btn--loading': loading },
    ]"
  >
    <span v-if="loading" class="v-btn__spinner" aria-hidden="true">
      <Loader2 :size="spinnerSize" />
    </span>
    <span v-else-if="$slots.left" class="v-btn__icon">
      <slot name="left" />
    </span>
    <span class="v-btn__label"><slot /></span>
    <span v-if="!loading && $slots.right" class="v-btn__icon">
      <slot name="right" />
    </span>
  </component>
</template>

<style scoped>
.v-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: var(--r-btn);
  font-family: var(--font-sans);
  font-weight: var(--w-semibold);
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--dur-fast) var(--ease-out),
    background var(--dur-fast),
    border-color var(--dur-fast),
    filter var(--dur-fast);

  &:disabled,
  &[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.55;
    pointer-events: none;
  }

  &:not(:disabled):not([aria-disabled='true']):active {
    transform: scale(0.97);
  }

  &.v-btn--full {
    width: 100%;
  }

  /* sizes */
  &.v-btn--sm {
    font-size: var(--text-sm);
    padding: 7px 13px;
    min-height: 34px;
    gap: 6px;
  }

  &.v-btn--md {
    font-size: 0.9rem;
    padding: 9px 16px;
    min-height: var(--tap-min);
  }

  &.v-btn--lg {
    font-size: var(--text-base);
    padding: 13px 22px;
    min-height: 48px;
    gap: 8px;
  }

  /* variants */
  &.v-btn--primary {
    background: var(--rose-500);
    color: var(--text-on-accent);
    box-shadow: var(--shadow-float);

    &:not(:disabled):not([aria-disabled='true']):hover {
      filter: brightness(0.94);
    }
  }

  &.v-btn--blue {
    background: var(--blue-500);
    color: var(--text-on-accent);

    &:not(:disabled):not([aria-disabled='true']):hover {
      filter: brightness(0.94);
    }
  }

  &.v-btn--secondary {
    background: var(--surface);
    color: var(--text);
    border: 1.5px solid var(--hairline-2);

    &:not(:disabled):not([aria-disabled='true']):hover {
      background: var(--surface-sunk);
      border-color: var(--ink-3);
    }
  }

  &.v-btn--ghost {
    background: transparent;
    color: var(--rose-600);

    &:not(:disabled):not([aria-disabled='true']):hover {
      background: var(--rose-50);
    }
  }
}

.v-btn__icon,
.v-btn__spinner {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  line-height: 0;
}

.v-btn__spinner {
  animation: vspin 700ms linear infinite;
}

.v-btn__label {
  display: inline-flex;
  align-items: center;
}
</style>
