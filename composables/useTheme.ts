const STORAGE_KEY = 'vocabu-theme';

// Resolve the theme actually in effect: an explicit [data-theme] override wins,
// otherwise fall back to the OS preference. Pure — reads globals only.
const readEffectiveDark = (): boolean => {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Light/dark toggle that speaks the same language as the app: it writes the
// 'vocabu-theme' key the FOUC-guard script in nuxt.config reads, and flips the
// [data-theme] attribute the CSS keys off. A visitor's choice on the landing
// therefore carries straight into the app.
export const useTheme = () => {
  const isDark = ref(false);

  const apply = (dark: boolean) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
      // Storage may be blocked (private mode); the in-memory flip still works.
    }
    isDark.value = dark;
  };

  const toggle = () => apply(!isDark.value);

  onMounted(() => {
    isDark.value = readEffectiveDark();
  });

  return { isDark, toggle };
};
