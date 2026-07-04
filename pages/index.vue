<script setup lang="ts">
import {
  ArrowRight,
  BadgeCheck,
  Check,
  History,
  Mail,
  Mic,
  Moon,
  Sun,
} from 'lucide-vue-next';

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
const { toggle: toggleTheme } = useTheme();

useSeoMeta({
  title: 'Vocabu — keep the way they actually talk',
  description:
    'A personal dictionary of how the people you love talk — their words, in their voice, before they slip away. Never lose your sweet moments.',
  ogTitle: 'Vocabu — keep the way they actually talk',
  ogDescription:
    'Keep the words of the people you love — in their voice — before they quietly slip away.',
  ogType: 'website',
});

// Reveal-on-scroll: progressive enhancement only. Without IntersectionObserver
// (or under reduced-motion) everything is shown up front.
onMounted(() => {
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
    <!-- NAV -->
    <header class="nav">
      <div class="wrap nav__in">
        <a class="brand" href="/" aria-label="Vocabu home">
          <img src="/logo-mark.svg" alt="" width="28" height="28" />
          <b>Vocabu</b>
        </a>
        <div class="nav__spacer"></div>
        <nav class="nav__links">
          <a class="ghost-link hide-sm" href="#why">why vocabu</a>
          <button
            class="theme-toggle"
            type="button"
            aria-label="Toggle dark mode"
            @click="toggleTheme"
          >
            <span class="theme-toggle__sun"><Sun :size="20" /></span>
            <span class="theme-toggle__moon"><Moon :size="20" /></span>
          </button>
        </nav>
      </div>
    </header>

    <main>
      <!-- HERO -->
      <section id="start" class="hero">
        <div class="wrap hero__grid">
          <div class="hero__copy">
            <span class="eyebrow">
              <span class="eyebrow__dot"></span>a dictionary of the people you
              love
            </span>
            <h1 class="hero__h">
              Keep the way<br />they <span class="accent">actually</span> talk.
            </h1>
            <p class="hero__sub">
              Your daughter's first mispronounced words. Your dad's worn-out
              advice. A friend's ridiculous phrase. Vocabu keeps them — in their
              voice — before they quietly slip away.
            </p>

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
                  placeholder="you@email.com"
                  aria-label="your email"
                  :readonly="submitting"
                />
                <VButton
                  class="capture__submit"
                  type="submit"
                  variant="primary"
                  size="lg"
                  :loading="submitting"
                  :disabled="!validEmail"
                >
                  get my login link
                  <template #right>
                    <ArrowRight :size="18" />
                  </template>
                </VButton>
              </div>
              <p class="capture__note">
                <Mail :size="15" />
                no password — we'll email you a link. free to start.
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
                <h4 class="sent__h">Check your inbox</h4>
                <p class="sent__p">
                  We sent a sign-in link to <b>{{ trimmedEmail }}</b
                  >.
                  <button class="sent__again" type="button" @click="reset">
                    Use a different email
                  </button>
                </p>
              </div>
            </div>
          </div>

          <div class="hero__phone">
            <LandingPhoneMock />
          </div>
        </div>
      </section>

      <!-- REASONS -->
      <section id="why" class="reasons">
        <div class="wrap">
          <div class="band-head reveal">
            <div class="overline overline--rose">why vocabu</div>
            <h2 class="band-h">A keepsake, not a feed.</h2>
            <p>
              Photos catch how a moment looked. Vocabu catches how it
              <em>sounded</em> — the exact words, the wrong pronunciations, the
              sayings you'll want back one day.
            </p>
          </div>
          <div class="reason-grid">
            <article class="card card--blue reveal">
              <div class="card__badge"><Mic :size="24" /></div>
              <h3>In their real voice</h3>
              <p>
                Attach a clip and hear them say it. The waveform plays right
                inside the entry — the moment stays exactly as it sounded.
              </p>
            </article>
            <article class="card card--rose reveal">
              <div class="card__badge"><BadgeCheck :size="24" /></div>
              <h3>Built for keeping</h3>
              <p>
                No followers to chase, no streaks, no numbers shouting at you.
                Quiet by design — yours, and the few you choose to share with.
              </p>
            </article>
            <article class="card card--blue reveal">
              <div class="card__badge"><History :size="24" /></div>
              <h3>On this day</h3>
              <p>
                A year later, a phrase you'd half-forgotten resurfaces — gently,
                right when it lands hardest.
              </p>
            </article>
          </div>
        </div>
      </section>

      <!-- HOW -->
      <section class="how">
        <div class="wrap">
          <div class="band-head reveal">
            <div class="overline overline--rose">how it works</div>
            <h2 class="band-h">Two taps to keep a word.</h2>
          </div>
          <ol class="steps">
            <li class="step reveal">
              <div class="step__n">1</div>
              <h3>Catch it</h3>
              <p>
                Heard something you don't want to lose? Type the word and who
                said it. That's a keep.
              </p>
            </li>
            <li class="step reveal">
              <div class="step__n">2</div>
              <h3>Add their voice</h3>
              <p>
                Upload a clip, a meaning, the little story behind it — whenever
                you have a moment.
              </p>
            </li>
            <li class="step reveal">
              <div class="step__n">3</div>
              <h3>Keep it forever</h3>
              <p>
                It's filed in your dictionary, ready to resurface and make you
                smile years from now.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <!-- CLOSER -->
      <section class="closer">
        <div class="wrap">
          <div class="closer__card reveal">
            <div class="overline overline--blue">
              never lose your sweet moments
            </div>
            <h2 class="closer__h">
              Start before you <span class="word-script">forget</span>.
            </h2>
            <p class="closer__p">
              The sweetest things they say are the easiest to lose. Keep the
              first one today — it takes about thirty seconds.
            </p>
            <div class="closer__actions">
              <VButton href="#start" variant="primary" size="lg">
                start your dictionary
              </VButton>
              <VButton href="/login" variant="secondary" size="lg">
                sign in
              </VButton>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- FOOTER -->
    <footer class="foot">
      <div class="wrap foot__in">
        <a class="brand" href="/">
          <img src="/logo-mark.svg" alt="" width="24" height="24" />
          <b>Vocabu</b>
        </a>
        <span class="foot__tag">never lose your sweet moments.</span>
        <nav class="foot__links">
          <a href="#why">why vocabu</a>
          <a href="/login">sign in</a>
        </nav>
      </div>
    </footer>
  </div>
</template>

<style scoped>
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

.theme-toggle {
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}

.theme-toggle:hover {
  background: var(--surface-sunk);
  color: var(--text);
}

.theme-toggle__sun,
.theme-toggle__moon {
  display: inline-flex;
}

/* Icon follows the actual theme with zero JS, mirroring theme-dark.css so
   there's no post-hydration flip for OS-dark visitors. */
.theme-toggle__moon {
  display: none;
}

:global(html[data-theme='dark'] .theme-toggle__sun) {
  display: none;
}

:global(html[data-theme='dark'] .theme-toggle__moon) {
  display: inline-flex;
}

@media (prefers-color-scheme: dark) {
  :global(html:not([data-theme='light']) .theme-toggle__sun) {
    display: none;
  }
  :global(html:not([data-theme='light']) .theme-toggle__moon) {
    display: inline-flex;
  }
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
  gap: 10px;
}

.field-row__input {
  flex: 1;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: 16px;
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
  font-size: 16px;
  font-weight: var(--w-bold);
  color: var(--text);
}

.sent__p {
  margin: 4px 0 0;
  font-size: 14px;
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
  font-size: 14px;
  color: var(--text-muted);
  white-space: nowrap;
}

.foot__links {
  margin-left: auto;
  display: flex;
  gap: 22px;
}

.foot__links a {
  font-size: 14px;
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
