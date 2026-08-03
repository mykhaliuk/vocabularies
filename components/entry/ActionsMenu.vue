<script setup lang="ts">
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next';

// The ⋯ menu in the word detail's top bar (entry-actions-spec.html §The
// surfaces). Rare actions earn a quiet home: nothing is drawn at rest, and the
// feed stays a reading surface with no per-card affordances at all.
//
// Unconditionally rendered for the reader who got here, because there is no
// other kind: getOwnEntry filters by ownerId and throws otherwise
// (server/domain/entries.ts), so the API cannot hand this screen an entry that
// is not the reader's own. The spec's "someone else's entry" branch waits for
// the sharing it describes.
// `disabled` is how the confirm sheet takes the bar out of play. It matters
// more than it looks: this menu opens inside the bar's z-index 20, the sheet
// sits at 60, so a ⋯ still reachable by Shift+Tab from behind the scrim would
// put keyboard focus into a menu rendered UNDERNEATH it.
const props = withDefaults(defineProps<{ disabled?: boolean }>(), {
  disabled: false,
});

const emit = defineEmits<{ edit: []; delete: [] }>();

// The edit item ships with its menu but stays dark until VKB-110 gives compose
// an edit mode. A module constant rather than runtime config on purpose: a
// half-built affordance must not be switchable on in dev or preview, where it
// would open nothing.
const IS_EDIT_ENABLED = false;

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
  // Only when the menu was dismissed by keyboard or by choosing an item:
  // pulling focus back after a tap would summon the on-screen keyboard's
  // focus ring on a screen the user has already moved past.
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

// Tab out and the menu is done — the WAI-ARIA menu pattern asks for it, and
// without it the window-level arrow handling below keeps stealing keys from a
// reader who has already walked away.
const onFocusOut = (event: FocusEvent) => {
  const next = event.relatedTarget;
  if (next instanceof Node && menu.value?.contains(next)) return;
  close();
};

// Focus is handed back rather than dropped: the sheet took it from here, so
// dismissing the sheet has somewhere to return it to (pages/entries/[id].vue).
const focusTrigger = () => {
  trigger.value?.focus();
};

defineExpose({ focusTrigger });

// Both close before they emit, never after: delete raises a sheet over this
// bar, and a menu still standing behind it would be a second dismissable layer.
const chooseEdit = () => {
  close();
  emit('edit');
};

const chooseDelete = () => {
  close();
  emit('delete');
};

// Roving focus over whatever items the flag above leaves standing, so the
// menu answers the arrow keys role="menu" promises.
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

    <!-- Tap anywhere else to dismiss (spec §The surfaces). A real element
         rather than a document listener, so the dismissing tap is swallowed
         instead of also landing on whatever it was over.
         Teleported, and that is load-bearing: the top bar carries a
         backdrop-filter, which makes it the containing block for every fixed
         descendant. Left in place, `inset: 0` resolves to the 54px BAR — the
         scrim covers the one strip of screen nobody taps to dismiss, and the
         menu can only be closed by the ⋯ itself. -->
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
        v-if="IS_EDIT_ENABLED"
        type="button"
        role="menuitem"
        class="actions__item"
        @click="chooseEdit"
      >
        <Pencil :size="17" aria-hidden="true" />{{
          t('app.entry.actions.edit')
        }}
      </button>

      <!-- The ellipsis is the standard promise that a confirm follows —
           nothing destructive happens on this tap. -->
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

  /* Inert behind the confirm, not hidden: the bar keeps its shape, so the
     title does not jump sideways as the sheet rises. */
  &:disabled {
    cursor: default;
    color: var(--ink-3);
  }
}

/* Teleported to <body>, so this sits in the ROOT stacking context: one step
   under the bar's own z-index 20, which puts it over the column and under the
   menu (a child of the bar, and so painted with it). */
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

/* First of the two terracotta marks the spec allows (the confirm button is the
   other). Foreground here, so it takes --danger, which re-themes. */
.actions__item--danger {
  color: var(--danger);
}

@media (prefers-reduced-motion: reduce) {
  .actions__trigger {
    transition: none;
  }
}
</style>
