<script setup lang="ts">
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next';

const props = withDefaults(defineProps<{ disabled?: boolean }>(), {
  disabled: false,
});

const emit = defineEmits<{ edit: []; delete: [] }>();

const { t } = useI18n();

const isOpen = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);

const items = () =>
  Array.from(
    menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
  );

const close = ({ restoreFocus = false } = {}) => {
  if (!isOpen.value) return;
  isOpen.value = false;
  if (restoreFocus) trigger.value?.focus();
};

const open = async () => {
  isOpen.value = true;
  await nextTick();
  items()[0]?.focus();
};

const toggle = () => {
  if (props.disabled) return;
  if (isOpen.value) close({ restoreFocus: true });
  else void open();
};

const onFocusOut = (event: FocusEvent) => {
  const next = event.relatedTarget;
  if (next instanceof Node && menu.value?.contains(next)) return;
  close();
};

const focusTrigger = () => {
  trigger.value?.focus();
};

defineExpose({ focusTrigger });

const chooseEdit = () => {
  close();
  emit('edit');
};

const chooseDelete = () => {
  close();
  emit('delete');
};

const moveFocus = (step: number) => {
  const focusable = items();
  if (focusable.length === 0) return;
  const current = focusable.indexOf(document.activeElement as HTMLElement);
  const next = (current + step + focusable.length) % focusable.length;
  focusable[next]?.focus();
};

const onKeydown = (event: KeyboardEvent) => {
  if (!isOpen.value) return;
  if (event.key === 'Escape') {
    close({ restoreFocus: true });
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFocus(1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocus(-1);
  }
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="actions" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="actions__trigger"
      :aria-label="t('app.entry.actions.menu')"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :disabled="disabled"
      @click="toggle"
    >
      <MoreHorizontal :size="21" aria-hidden="true" />
    </button>

    <!-- backdrop-filter on the bar makes it the containing block for fixed
         descendants, so an in-bar scrim resolves `inset: 0` to the bar's 54px.
         Hence the Teleport. -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="actions__scrim"
        aria-hidden="true"
        @click="close()"
      />
    </Teleport>

    <div
      v-if="isOpen"
      ref="menu"
      class="actions__menu"
      role="menu"
      :aria-label="t('app.entry.actions.menu')"
    >
      <button
        type="button"
        role="menuitem"
        class="actions__item"
        @click="chooseEdit"
      >
        <Pencil :size="17" aria-hidden="true" />{{
          t('app.entry.actions.edit')
        }}
      </button>

      <button
        type="button"
        role="menuitem"
        class="actions__item actions__item--danger"
        @click="chooseDelete"
      >
        <Trash2 :size="17" aria-hidden="true" />{{
          t('app.entry.actions.delete')
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: var(--tap-min);
  height: var(--tap-min);
}

.actions__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-out);

  &:active {
    transform: scale(0.9);
  }

  &:disabled {
    cursor: default;
    color: var(--ink-3);
  }
}

/* One under the bar's z-index 20: over the column, under the menu. */
.actions__scrim {
  position: fixed;
  inset: 0;
  z-index: 19;
}

.actions__menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 1;
  min-width: 176px;
  overflow: hidden;
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.actions__item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 46px;
  padding: 13px 18px 13px 16px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: var(--w-semibold);
  color: var(--ink);
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: var(--surface-sunk);
  }

  & + & {
    border-top: 1px solid var(--hairline);
  }
}

.actions__item--danger {
  color: var(--danger);
}

@media (prefers-reduced-motion: reduce) {
  .actions__trigger {
    transition: none;
  }
}
</style>
