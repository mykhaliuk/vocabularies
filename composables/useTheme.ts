const STORAGE_KEY = 'vocabu-theme';

export type ThemeMode = 'light' | 'dark' | 'system';

// An explicit override is stored as 'dark' | 'light'; anything else (missing
// key, unexpected value) means "follow the OS" — same contract the FOUC-guard
// script in nuxt.config.js reads.
const readStoredMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Storage may be blocked (private mode); fall back to system.
  }
  return 'system';
};

const readSystemDark = (): boolean =>
  window.matchMedia('(prefers-color-scheme: dark)').matches;

// Light/dark/system control that speaks the same language as the app: an
// explicit choice writes the 'vocabu-theme' key the FOUC-guard script in
// nuxt.config reads and flips the [data-theme] attribute the CSS keys off;
// choosing 'system' clears both, handing control back to the
// @media (prefers-color-scheme: dark) block in theme-dark.css. While in
// system mode, a matchMedia listener keeps isDark live if the OS theme flips
// without a reload.
export const useTheme = () => {
  const mode = ref<ThemeMode>('system');
  const isDark = ref(false);

  let media: MediaQueryList | null = null;

  const onSystemChange = (event: MediaQueryListEvent) => {
    if (mode.value === 'system') isDark.value = event.matches;
  };

  const setMode = (next: ThemeMode) => {
    mode.value = next;
    if (next === 'system') {
      delete document.documentElement.dataset.theme;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage may be blocked (private mode); the in-memory flip still works.
      }
      isDark.value = readSystemDark();
      return;
    }
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be blocked (private mode); the in-memory flip still works.
    }
    isDark.value = next === 'dark';
  };

  onMounted(() => {
    mode.value = readStoredMode();
    isDark.value =
      mode.value === 'system' ? readSystemDark() : mode.value === 'dark';
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', onSystemChange);
  });

  onUnmounted(() => {
    media?.removeEventListener('change', onSystemChange);
  });

  return { mode, isDark, setMode };
};
