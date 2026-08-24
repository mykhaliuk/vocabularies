<script setup lang="ts">
import {
  ArrowRight,
  BadgeCheck,
  Check,
  History,
  Mail,
  Mic,
  Monitor,
  Moon,
  Sun,
} from 'lucide-vue-next';
import {
  LANDING_LOCALE_NAMES,
  LANDING_LOCALE_PATHS,
  LANDING_LOCALES,
  LANDING_OG_LOCALES,
  LOCALE_COOKIE,
} from '~/shared/landing-locales';
import type { LandingCopy } from './copy.en';

// One prerendered page per locale: / is English, /fr and /uk are baked
// variants of the same component (ADR-0006). Copy comes in as a plain data
// prop, not through the i18n runtime; the locale travels ON the copy object
// so a copy/locale mismatch is unrepresentable.
const props = defineProps<{
  copy: LandingCopy;
}>();

const locale = props.copy.locale;

const CARD_ICONS = [Mic, BadgeCheck, History];

// Locale switcher: sets the vocabu-locale cookie before the (static) link
// navigation so the entry redirect on `/` honors the explicit choice — the
// only unauthenticated way to reach the English page from /fr | /uk
// (ADR-0004's "explicit choice persists" contract).
const rememberLocale = (code: string) => {
  // Direct document.cookie on purpose: the landing ships no i18n runtime
  // (ADR-0006) so setLocale/useCookie are unavailable, the Cookie Store API
  // is not universal, and the write must land synchronously before the
  // link's default navigation proceeds.
  // oxlint-disable-next-line no-document-cookie
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
};

const {
  email,
  trimmedEmail,
  validEmail,
  submitting,
  sent,
  errorMessage,
  submit,
  reset,
} = useMagicLink();
const { mode: themeMode, setMode: setThemeMode } = useTheme();

// Password managers can fill the field without an `input` event, leaving
// v-model stale: the submit button stays disabled, and a disabled default
// button suppresses the browser's implicit Enter submission entirely. Sync
// from the DOM on change and handle Enter explicitly so a filled field
// always submits.
function syncEmail(event: Event) {
  email.value = (event.target as HTMLInputElement).value;
}

async function submitOnEnter(event: KeyboardEvent) {
  syncEmail(event);
  await submit();
}

useSeoMeta({
  title: props.copy.seo.title,
  description: props.copy.seo.description,
  ogTitle: props.copy.seo.ogTitle,
  ogDescription: props.copy.seo.ogDescription,
  ogType: 'website',
  ogLocale: LANDING_OG_LOCALES[locale],
});

const { public: publicConfig } = useRuntimeConfig();
const toAbsolute = (path: string) => new URL(path, publicConfig.appUrl).href;
useHead({
  // Baked per page; overrides the app-level reactive lang from app.vue so
  // the prerendered HTML carries the page's own language.
  htmlAttrs: { lang: locale },
  link: [
    { rel: 'canonical', href: toAbsolute(LANDING_LOCALE_PATHS[locale]) },
    // Derived from the roster so a new locale can't be silently dropped
    // from the hreflang cluster.
    ...LANDING_LOCALES.map((code) => ({
      rel: 'alternate',
      hreflang: code,
      href: toAbsolute(LANDING_LOCALE_PATHS[code]),
    })),
    { rel: 'alternate', hreflang: 'x-default', href: toAbsolute('/') },
  ],
});

// True only while an installed standalone launch is deciding where to go. It
// gates the landing off the screen, because the hero form is bound to the plain
// (codeless) magic-link flow: a send from it mints a link with NO poll key,
// which can never sign the PWA in and burns a rate-limit slot — the exact
// defect VKB-70 exists to fix. Set synchronously (see onMounted), so that
// window does not exist regardless of how slow the session probe is.
const resolvingEntry = ref(false);

// Installed standalone PWAs open at the manifest start_url `/`, which renders
// this marketing landing — whose hero can never finish a cross-jar sign-in
// (VKB-70). Resolve the real entry instead: a launch already holding a session
// goes straight to the app, otherwise to /login (the poll/claim flow's home).
// The session check is what keeps the RETURNING user — the primary case — out
// of the sign-in form on every cold launch, and standalone has no address bar
// to escape it with. Client-only + onMounted so the prerendered landing is
// never redirected during SSR, and the probe is standalone-only so the public
// landing issues no extra request and stays byte-identical for web visitors.
// `replace` so the codeless landing is not left in the PWA's history.
const resolveStandaloneEntry = async () => {
  try {
    const probed = await probeSession();
    if (probed === 'session') {
      await navigateTo('/feed', { replace: true });
      return;
    }
    // Only a definite 401 may suppress the /login guard's own probe. On
    // `unknown` (timeout / offline / 5xx) we still fall back to /login, but
    // leave the hint unset so /login re-probes on a possibly warmer radio —
    // one extra bounded probe is far cheaper than making a signed-in user
    // re-authenticate.
    if (probed === 'none') markSignedOutHandoff();
    await navigateTo('/login', { replace: true });
  } catch (error) {
    // Operational failure — a route chunk that will not load (e.g. a stale
    // service-worker precache after a deploy) rejects the navigation. Release
    // the gate so the landing renders again: a recoverable surface beats
    // trapping the PWA on a blank screen it cannot navigate out of.
    console.error('[entry] standalone resolve failed', error);
    resolvingEntry.value = false;
  }
};

onMounted(() => {
  // Standalone PWA → resolve the entry before doing anything else. The gate is
  // set BEFORE any await: the codeless hero must never be interactive during a
  // standalone launch, however long the probe takes.
  if (isStandalone()) {
    resolvingEntry.value = true;
    void resolveStandaloneEntry();
    return;
  }

  // Reveal-on-scroll: progressive enhancement only. Without IntersectionObserver
  // (or under reduced-motion) everything is shown up front.
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('.reveal'),
  );
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    for (const el of elements) el.classList.add('in');
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.16 },
  );
  for (const el of elements) observer.observe(el);
});
</script>

<template>
  <div class="landing">
    <!-- Installed standalone launch: hold a neutral, inert surface while the
         entry resolves so the codeless hero form is never interactive. Web
         visitors never enter this branch — resolvingEntry stays false for them,
         so the markup below is exactly as before, with no extra request, no
         splash and no flash. The `.landing` root stays constant either way, so
         the component keeps a single stable root node to hydrate against. -->
    <div v-if="resolvingEntry" class="entry-splash" aria-hidden="true"></div>

    <template v-else>
      <!-- NAV -->
      <header class="nav">
        <div class="wrap nav__in">
          <a
            class="brand"
            :href="LANDING_LOCALE_PATHS[locale]"
            :aria-label="copy.nav.homeAria"
          >
            <img src="/logo-mark.svg" alt="" width="28" height="28" />
            <b>Vocabu</b>
          </a>
          <div class="nav__spacer"></div>
          <nav class="nav__links">
            <a class="ghost-link hide-sm" href="#why">{{ copy.nav.why }}</a>
            <div
              class="locale-switch"
              role="group"
              :aria-label="copy.nav.langAria"
            >
              <a
                v-for="code in LANDING_LOCALES"
                :key="code"
                class="locale-switch__link"
                :class="{ 'is-active': code === locale }"
                :href="LANDING_LOCALE_PATHS[code]"
                :hreflang="code"
                :aria-label="LANDING_LOCALE_NAMES[code]"
                :aria-current="code === locale ? 'page' : undefined"
                @click="rememberLocale(code)"
                >{{ code }}</a
              >
            </div>
            <div
              class="theme-toggle"
              role="group"
              :aria-label="copy.nav.themeAria"
            >
              <button
                class="theme-toggle__btn"
                type="button"
                :aria-label="copy.nav.themeLight"
                :aria-pressed="themeMode === 'light'"
                :class="{ 'is-active': themeMode === 'light' }"
                @click="setThemeMode('light')"
              >
                <Sun :size="18" />
              </button>
              <button
                class="theme-toggle__btn"
                type="button"
                :aria-label="copy.nav.themeSystem"
                :aria-pressed="themeMode === 'system'"
                :class="{ 'is-active': themeMode === 'system' }"
                @click="setThemeMode('system')"
              >
                <Monitor :size="18" />
              </button>
              <button
                class="theme-toggle__btn"
                type="button"
                :aria-label="copy.nav.themeDark"
                :aria-pressed="themeMode === 'dark'"
                :class="{ 'is-active': themeMode === 'dark' }"
                @click="setThemeMode('dark')"
              >
                <Moon :size="18" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <!-- HERO -->
        <section id="start" class="hero">
          <div class="wrap hero__grid">
            <div class="hero__copy">
              <span class="eyebrow">
                <span class="eyebrow__dot"></span>{{ copy.hero.eyebrow }}
              </span>
              <h1 class="hero__h">
                {{ copy.hero.titleTop }}<br />{{ copy.hero.titleAccentPre
                }}<span class="accent">{{ copy.hero.titleAccent }}</span
                >{{ copy.hero.titleAccentPost }}
              </h1>
              <p class="hero__sub">{{ copy.hero.sub }}</p>

              <form
                v-if="!sent"
                class="capture"
                novalidate
                @submit.prevent="submit"
              >
                <div class="field-row">
                  <input
                    v-model="email"
                    class="field-row__input"
                    type="email"
                    inputmode="email"
                    autocomplete="email"
                    :placeholder="copy.hero.emailPlaceholder"
                    :aria-label="copy.hero.emailAria"
                    :readonly="submitting"
                    @change="syncEmail"
                    @keydown.enter.prevent="submitOnEnter"
                  />
                  <VButton
                    class="capture__submit"
                    type="submit"
                    variant="primary"
                    size="lg"
                    :loading="submitting"
                    :disabled="!validEmail"
                  >
                    {{ copy.hero.submit }}
                    <template #right>
                      <ArrowRight :size="18" />
                    </template>
                  </VButton>
                </div>
                <p class="capture__note">
                  <Mail :size="15" />
                  {{ copy.hero.note }}
                </p>
                <p v-if="errorMessage" role="alert" class="capture__error">
                  {{ errorMessage }}
                </p>
              </form>

              <div v-else class="sent" role="status" aria-live="polite">
                <span class="sent__check">
                  <Check :size="16" :stroke-width="3" />
                </span>
                <div>
                  <h4 class="sent__h">{{ copy.sent.title }}</h4>
                  <p class="sent__p">
                    {{ copy.sent.body }} <b>{{ trimmedEmail }}</b
                    >.
                    <button class="sent__again" type="button" @click="reset">
                      {{ copy.sent.again }}
                    </button>
                  </p>
                </div>
              </div>
            </div>

            <div class="hero__phone">
              <LandingPhoneMock :copy="copy.phone" />
            </div>
          </div>
        </section>

        <!-- REASONS -->
        <section id="why" class="reasons">
          <div class="wrap">
            <div class="band-head reveal">
              <div class="overline overline--rose">
                {{ copy.reasons.overline }}
              </div>
              <h2 class="band-h">{{ copy.reasons.title }}</h2>
              <p>
                {{ copy.reasons.bodyPre }}<em>{{ copy.reasons.bodyEm }}</em
                >{{ copy.reasons.bodyPost }}
              </p>
            </div>
            <div class="reason-grid">
              <article
                v-for="(card, index) in copy.reasons.cards"
                :key="card.title"
                class="card reveal"
                :class="index === 1 ? 'card--rose' : 'card--blue'"
              >
                <div class="card__badge">
                  <component :is="CARD_ICONS[index]" :size="24" />
                </div>
                <h3>{{ card.title }}</h3>
                <p>{{ card.body }}</p>
              </article>
            </div>
          </div>
        </section>

        <!-- HOW -->
        <section class="how">
          <div class="wrap">
            <div class="band-head reveal">
              <div class="overline overline--rose">{{ copy.how.overline }}</div>
              <h2 class="band-h">{{ copy.how.title }}</h2>
            </div>
            <ol class="steps">
              <li
                v-for="(step, index) in copy.how.steps"
                :key="step.title"
                class="step reveal"
              >
                <div class="step__n">{{ index + 1 }}</div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.body }}</p>
              </li>
            </ol>
          </div>
        </section>

        <!-- CLOSER -->
        <section class="closer">
          <div class="wrap">
            <div class="closer__card reveal">
              <div class="overline overline--blue">
                {{ copy.closer.overline }}
              </div>
              <h2 class="closer__h">
                {{ copy.closer.titlePre
                }}<span class="word-script">{{ copy.closer.titleScript }}</span
                >{{ copy.closer.titlePost }}
              </h2>
              <p class="closer__p">{{ copy.closer.body }}</p>
              <div class="closer__actions">
                <VButton href="/login" variant="primary" size="lg">
                  {{ copy.closer.start }}
                </VButton>
                <VButton href="/login" variant="secondary" size="lg">
                  {{ copy.closer.signIn }}
                </VButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- FOOTER -->
      <footer class="foot">
        <div class="wrap foot__in">
          <a class="brand" :href="LANDING_LOCALE_PATHS[locale]">
            <img src="/logo-mark.svg" alt="" width="24" height="24" />
            <b>Vocabu</b>
          </a>
          <span class="foot__tag">{{ copy.footer.tag }}</span>
          <nav class="foot__links">
            <a href="#why">{{ copy.footer.why }}</a>
          </nav>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
/* Inert holding surface for a standalone launch — brand canvas only, nothing
   interactive, no spinner (the resolve is bounded and short). */
.entry-splash {
  min-height: 100dvh;
  background: var(--bg);
}

.landing {
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}

.wrap {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  color: inherit;
  text-decoration: none;
}

.brand img {
  border-radius: 7px;
  display: block;
}

.brand b {
  font-size: 21px;
  font-weight: var(--w-bold);
  letter-spacing: -0.03em;
}

.word-script {
  font-family: var(--font-hand);
  font-weight: var(--w-semibold);
  letter-spacing: 0;
}

/* ---- nav ---- */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--bar-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--hairline);
}

.nav__in {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
}

.nav__spacer {
  flex: 1;
}

.nav__links {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ghost-link {
  font-size: 15px;
  font-weight: var(--w-semibold);
  color: var(--text-muted);
  padding: 10px 14px;
  border-radius: var(--r-btn);
  text-decoration: none;
  transition:
    color var(--dur-fast),
    background var(--dur-fast);
}

.ghost-link:hover {
  color: var(--text);
  background: var(--surface-sunk);
}

.locale-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.locale-switch__link {
  font-size: 13px;
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  padding: 8px 10px;
  border-radius: var(--r-btn);
  text-decoration: none;
  transition:
    color var(--dur-fast),
    background var(--dur-fast);
}

.locale-switch__link:hover {
  color: var(--text);
  background: var(--surface-sunk);
}

.locale-switch__link.is-active {
  color: var(--text);
  background: var(--surface-sunk);
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--surface-sunk);
  border-radius: var(--r-pill);
}

.theme-toggle__btn {
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: var(--r-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}

.theme-toggle__btn:hover {
  color: var(--text);
}

.theme-toggle__btn.is-active {
  background: var(--rose-50);
  color: var(--on-primary-soft);
}

/* ---- hero ---- */
.hero {
  position: relative;
  padding: clamp(48px, 7vw, 96px) 0 clamp(56px, 7vw, 104px);
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: -10% -20% auto -20%;
  height: 130%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(
      60% 50% at 18% 8%,
      color-mix(in oklch, var(--rose-500) 12%, transparent),
      transparent 60%
    ),
    radial-gradient(
      55% 50% at 92% 30%,
      color-mix(in oklch, var(--blue-500) 11%, transparent),
      transparent 60%
    );
}

.hero__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: var(--w-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--hairline);
  padding: 7px 13px 7px 10px;
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-xs);
}

.eyebrow__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
}

.hero__h {
  margin: 20px 0 0;
  font-size: clamp(2.5rem, 5.4vw, 4rem);
  font-weight: var(--w-extra);
  line-height: 1.04;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.hero__h .accent {
  color: var(--primary);
}

.hero__sub {
  margin: 22px 0 0;
  max-width: 30em;
  font-size: clamp(1.05rem, 1.5vw, 1.2rem);
  line-height: 1.55;
  color: var(--text-muted);
  text-wrap: pretty;
}

/* ---- magic-link form ---- */
.capture {
  margin-top: 32px;
  max-width: 470px;
}

.field-row {
  display: flex;
  /* Paired with the input's min-width below — the floor is what makes this row
     break rather than squeeze, and neither half works alone. */
  flex-wrap: wrap;
  gap: 10px;
}

.field-row__input {
  flex: 1;
  /* The submit never wraps its label, so without a floor a long translation
     shrinks this field until the address it asks for no longer fits. */
  min-width: 11em;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text);
  background: var(--surface);
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-md);
  padding: 0 16px;
  height: 54px;
  outline: none;
  transition:
    border-color var(--dur-fast),
    box-shadow var(--dur-fast);
}

.field-row__input::placeholder {
  color: var(--text-faint);
}

.field-row__input:focus-visible {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.field-row__input:read-only {
  background: var(--surface-sunk);
}

.capture__note {
  margin: 12px 2px 0;
  font-size: 13.5px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 7px;
}

.capture__error {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--danger-bg);
  color: var(--danger);
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
}

.sent {
  margin-top: 32px;
  max-width: 470px;
  display: flex;
  align-items: flex-start;
  gap: 13px;
  background: var(--secondary-soft);
  border: 1px solid var(--blue-100);
  border-radius: var(--r-md);
  padding: 16px 18px;
  animation: vfadeup var(--dur-slow) var(--ease-out) both;
}

.sent__check {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex: 0 0 auto;
  margin-top: 1px;
  background: var(--secondary);
  color: var(--text-on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sent__h {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--w-bold);
  color: var(--text);
}

.sent__p {
  margin: 4px 0 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-muted);
}

.sent__again {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--link);
  font-weight: var(--w-semibold);
  font-size: inherit;
}

/* ---- band head (reasons + how) ---- */
.band-head {
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}

.overline {
  font-size: 12.5px;
  font-weight: var(--w-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.overline--rose {
  /* Darker rose so the small uppercase label clears AA on the page bg in both
     themes (--primary / rose-500 only hits 3.4:1 on light). */
  color: var(--on-primary-soft);
}

.overline--blue {
  color: var(--on-secondary-soft);
}

.band-h {
  margin: 12px 0 0;
  font-size: clamp(1.9rem, 3.4vw, 2.6rem);
  font-weight: var(--w-extra);
  letter-spacing: -0.03em;
  line-height: 1.1;
  text-wrap: balance;
}

.band-head p {
  margin: 14px 0 0;
  font-size: 1.08rem;
  line-height: 1.55;
  color: var(--text-muted);
  text-wrap: pretty;
}

/* ---- reasons ---- */
.reasons {
  padding: clamp(56px, 8vw, 100px) 0;
}

.reason-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 52px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  padding: 28px 26px 30px;
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base);
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.card__badge {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.card--rose .card__badge {
  background: var(--primary-soft);
  color: var(--on-primary-soft);
}

.card--blue .card__badge {
  background: var(--secondary-soft);
  color: var(--on-secondary-soft);
}

.card h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: var(--w-bold);
  letter-spacing: -0.02em;
}

.card p {
  margin: 11px 0 0;
  font-size: 1rem;
  line-height: 1.58;
  color: var(--text-muted);
}

/* ---- how ---- */
.how {
  padding: clamp(40px, 6vw, 72px) 0 clamp(56px, 8vw, 100px);
}

.steps {
  list-style: none;
  margin: 52px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.step {
  padding: 26px 24px;
  border-radius: var(--r-lg);
  background: var(--surface-sunk);
}

.step__n {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--hairline);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--w-extra);
  font-size: 15px;
  color: var(--primary);
  margin-bottom: 16px;
}

.step h3 {
  margin: 0;
  font-size: 1.12rem;
  font-weight: var(--w-bold);
  letter-spacing: -0.01em;
}

.step p {
  margin: 9px 0 0;
  font-size: 0.98rem;
  line-height: 1.55;
  color: var(--text-muted);
}

/* ---- closer ---- */
.closer {
  padding: 0 0 clamp(64px, 9vw, 110px);
}

.closer__card {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-xl);
  background: var(--secondary-soft);
  border: 1px solid var(--blue-100);
  padding: clamp(44px, 6vw, 76px) clamp(28px, 5vw, 64px);
  text-align: center;
}

.closer__h {
  margin: 14px 0 0;
  font-size: clamp(2rem, 4.2vw, 3.1rem);
  font-weight: var(--w-extra);
  letter-spacing: -0.035em;
  line-height: 1.06;
}

.closer__h .word-script {
  color: var(--primary);
}

.closer__p {
  margin: 16px auto 0;
  max-width: 34em;
  font-size: 1.08rem;
  line-height: 1.55;
  color: var(--text-muted);
}

.closer__actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ---- footer ---- */
.foot {
  border-top: 1px solid var(--hairline);
  padding: 40px 0 56px;
}

.foot__in {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.foot .brand b {
  font-size: 18px;
}

.foot__tag {
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: nowrap;
}

.foot__links {
  margin-left: auto;
  display: flex;
  gap: 22px;
}

.foot__links a {
  font-size: var(--text-sm);
  font-weight: var(--w-medium);
  color: var(--text-muted);
  white-space: nowrap;
  text-decoration: none;
}

.foot__links a:hover {
  color: var(--text);
}

/* ---- reveal ---- */
.reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 600ms var(--ease-out),
    transform 600ms var(--ease-out);
}

.reveal.in {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

/* ---- responsive ---- */
@media (max-width: 900px) {
  .hero__grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .hero__phone {
    margin-top: 24px;
    order: 2;
  }
  .reason-grid,
  .steps {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .wrap {
    padding: 0 18px;
  }
  .field-row {
    flex-direction: column;
  }
  .field-row__input {
    /* Reset flex so the column axis stops collapsing the field to one line;
       height: 54px (base rule) then applies. */
    flex: 0 0 auto;
    width: 100%;
  }
  .capture__submit {
    width: 100%;
  }
  .hide-sm {
    display: none;
  }
}
</style>
