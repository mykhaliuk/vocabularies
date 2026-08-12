<script setup lang="ts">
import { Bookmark, Calendar, ChevronDown, CircleAlert } from 'lucide-vue-next';

definePageMeta({ layout: false, middleware: 'auth' });

// Read layout: word-detail-spec.html. ⋯ menu: entry-actions-spec.html.

// Shapes returned by GET /api/entries/:id (declared inline — no DTO layer).
type EntryMedia = {
  mediaId: string;
  kind: 'audio' | 'video';
  status: 'processing' | 'ready' | 'failed';
  durationSec: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
  error: string | null;
};

type EntrySpeaker = {
  name: string;
  tone: 'rose' | 'blue' | 'ink' | null;
  rel: string | null;
  birthday: string | null;
};

type EntryDetail = {
  id: string;
  word: string;
  gloss: string | null;
  speaker: EntrySpeaker | null;
  // Display-only `speaker` above cannot drive a chip selection; the edit
  // sheet prefills its speaker row from this.
  sid: string | null;
  saidAt: string;
  story: string | null;
  collection: string | null;
  createdAt: string;
};

type EntryDetailResponse = {
  entry: EntryDetail;
  media: EntryMedia | null;
  playback: {
    videoUrl: string | null;
    posterUrl: string | null;
    audioUrl: string | null;
  } | null;
};

const { t, locale } = useI18n();
const route = useRoute();
// NuxtPage keys the page by its interpolated path, so a different id mounts
// a fresh component — the id can be read once rather than watched.
const entryId = String(route.params.id);

// useRequestFetch forwards the incoming request's cookies during SSR (a bare
// $fetch to an internal route does not), so the first render is
// authenticated instead of 401ing into the error state.
const requestFetch = useRequestFetch();
const {
  data,
  error: fetchError,
  refresh,
} = await useAsyncData(`entry:${entryId}`, () =>
  requestFetch<EntryDetailResponse>(
    `/api/entries/${encodeURIComponent(entryId)}`,
  ),
);

const entry = computed(() => data.value?.entry ?? null);
const media = computed(() => data.value?.media ?? null);

// A 4xx is an answer, not a hiccup: the word is gone, was never there, or
// was never askable — an id that is not a uuid fails the route's own
// `z.string().uuid()` and comes back 400, not 404. Offering "try again" for
// any of them would promise a retry that re-issues the identical request
// forever. 408 and 429 are the two that really do mean "later"; they join
// 5xx and the network failures (no status at all) in the retryable branch.
//
// Short and stable, so an array rather than a Set.
const RETRYABLE_CLIENT_STATUSES = [408, 429];

// 401 is the one 4xx that says nothing about the word at all: the entry may
// be perfectly fine and the reader is simply no longer signed in. The route
// guard cannot have caught it — it skips its session probe when both sides
// of the hop are authed routes (middleware/auth.ts), which is exactly the
// feed → word tap this screen adds, so a session revoked from another
// device first surfaces right here.
const UNAUTHORIZED = 401;

// Two questions kept apart, because one boolean cannot answer both: is a
// retry meaningful, and what actually happened. `null` is a healthy load —
// useAsyncData types its error ref as `Ref<NuxtError | undefined>` and
// clears it by writing `void 0`, so an `undefined` check is the one that
// does not call every successful load a failure.
type LoadFailure = 'signed-out' | 'gone' | 'hiccup';

const failure = computed<LoadFailure | null>(() => {
  if (fetchError.value === undefined) return null;
  const status = fetchError.value.statusCode;
  if (status === UNAUTHORIZED) return 'signed-out';
  if (status === undefined) return 'hiccup';
  if (RETRYABLE_CLIENT_STATUSES.includes(status)) return 'hiccup';
  return status >= 400 && status < 500 ? 'gone' : 'hiccup';
});

// Signed out is answered the way /me already answers it (pages/me.vue) —
// hand the reader to sign-in. Telling them their word is gone would be a
// statement of fact about someone else's data that we never checked.
const redirectWhenSignedOut = async () => {
  if (failure.value !== 'signed-out') return;
  await navigateTo('/login');
};
await redirectWhenSignedOut();

// The state block's one line of copy. 'signed-out' deliberately renders
// nothing: the redirect above is already in flight, and a frame of "this
// word isn't here any more" would be a lie on the way out.
const stateCopy = computed(() => {
  if (failure.value === 'gone') return t('app.entry.notFound');
  if (failure.value === 'hiccup') return t('app.entry.loadError');
  return '';
});

// No try/catch around refresh(): it cannot reject. Nuxt catches inside its
// own promise chain, parks the failure on the error ref above and resolves —
// so a failed retry surfaces as a re-render, never as a throw. A retry that
// comes back 401 (the session died while the state block was on screen) is
// the same answer as a first load that does, and gets the same redirect.
const retry = async () => {
  await refresh();
  try {
    await redirectWhenSignedOut();
  } catch (error) {
    // navigateTo CAN reject — a stale precache or a failed chunk after a
    // deploy (pages/login.vue hits the same). By this point refresh()'s own
    // catch has already set error.value and reset data.value to null, so
    // entry is null, failure is 'signed-out' and stateCopy is '' for that
    // case — v-else-if="stateCopy" (line 292) then renders neither branch,
    // leaving the reader looking at the bare top bar over an empty column.
    // There is no state left to fall back to; logging is all that is left.
    console.error('[entry] sign-in redirect failed', error);
  }
};

// Seed the playback cache from the payload this page already holds, so the
// player mounted below does not re-request the same entry on first play.
// Runs during setup, ahead of any child mounting; the composable drops the
// call on the server, where its cache is shared across requests.
const { primePlayback } = useEntryPlayback();
watchEffect(() => {
  const loaded = data.value;
  if (loaded) primePlayback(loaded.entry.id, loaded.playback);
});

const { formatAgeLabel, formatSpeakerLead, formatSpeakerTail } =
  useSpeakerLine();
const speakerLead = computed(() =>
  formatSpeakerLead(entry.value?.speaker ?? null),
);
const speakerRest = computed(() =>
  entry.value
    ? formatSpeakerTail(entry.value.speaker, entry.value.saidAt)
    : null,
);

const headwordSize = computed(() => headwordSizePx(entry.value?.word ?? ''));

// A bare `en` tag resolves to the US region, which prints "Aug 2, 2026";
// the spec draws "10 May 2026", and fr/uk already put the day first. Only
// the date layer is regionalised — the i18n locale key stays `en`.
const DATE_REGIONS: Record<string, string> = { en: 'en-GB' };

// The said-on date is the one date the app renders as text, and it is
// rendered in the reader's locale: the mocks' fixed "10 May 2026" would be
// a bug in fr and uk. saidAt is a plain YYYY-MM-DD, so it is formatted in
// UTC — the calendar day is the fact, and a negative-offset viewer must not
// be shown the day before.
const saidAtLabel = computed(() => {
  const value = entry.value?.saidAt;
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  const tag = DATE_REGIONS[locale.value] ?? locale.value;
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
});

// The frozen age rides the date row as well as the metaline — the speaker
// spec puts it in both, because the date is what the age is measured from.
const saidLine = computed(() => {
  if (!entry.value) return '';
  const age = formatAgeLabel(entry.value.speaker, entry.value.saidAt);
  const date = saidAtLabel.value;
  return age === undefined
    ? t('app.entry.saidOn', { date })
    : t('app.entry.saidOnAged', { date, age });
});

// Correcting the date (speaker-spec §Correcting the date): the write lands
// as you pick, so the editor holds no draft the reader could lose — the
// candidate only feeds the consequence sentence's age preview.
const isEditingDate = ref(false);
const candidateSaidAt = ref('');
const hasDateError = ref(false);
const maxSaidAt = ref('');
const dateTrigger = ref<HTMLButtonElement | null>(null);
const dateInput = ref<HTMLInputElement | null>(null);

const candidateAge = computed(() =>
  entry.value
    ? formatAgeLabel(entry.value.speaker, candidateSaidAt.value)
    : undefined,
);

const toIsoDay = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

// The date the screen is trying to land, which is not the entry's own
// saidAt until the answer comes back — a pick is compared against this, so
// picking a date and picking it straight back still sends the second one.
// Empty means nothing is wanted beyond what the word already carries.
let requestedSaidAt = '';
let isSaving = false;

// Opens on the date being landed, not the one the word still carries:
// reopening while a write is in the air must neither offer the old day back
// nor overwrite what the loop below is chasing. The ceiling is read here
// rather than computed once — this only runs on the client, so it is the
// reader's own today, and a tab left open overnight picks up the new day.
const openDateEditor = async () => {
  candidateSaidAt.value = requestedSaidAt || entry.value?.saidAt || '';
  requestedSaidAt = candidateSaidAt.value;
  maxSaidAt.value = toIsoDay(new Date());
  hasDateError.value = false;
  isEditingDate.value = true;
  await nextTick();
  dateInput.value?.focus();
};

const closeDateEditor = async () => {
  isEditingDate.value = false;
  hasDateError.value = false;
  await nextTick();
  dateTrigger.value?.focus();
};

const sendSaidAt = async (saidAt: string) => {
  hasDateError.value = false;
  try {
    const updated = await $fetch<EntryDetailResponse>(
      `/api/entries/${encodeURIComponent(entryId)}`,
      { method: 'PATCH', credentials: 'include', body: { saidAt } },
    );
    if (!data.value) return true;
    // useAsyncData hands back a shallowRef, so the payload is replaced
    // rather than mutated — assigning `.entry` renders nothing. Media and
    // playback are carried over by identity: a date cannot touch them, and
    // swapping them would churn the player's props for nothing.
    data.value = { ...data.value, entry: updated.entry };
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === UNAUTHORIZED) {
      try {
        await navigateTo('/login');
        return false;
      } catch (redirectError) {
        console.error('[entry] sign-in redirect failed', redirectError);
      }
    }
    console.error('[entry] date change failed', error);
    hasDateError.value = true;
    // The reader may have tapped done while this was in flight, and the
    // error line only exists inside the open editor. Reopening is the only
    // way a refused date is reported rather than quietly not happening —
    // and it takes the focus with it, because the trigger that held it is
    // the element being replaced. Only when reopening: an editor already on
    // screen has the focus somewhere the reader put it.
    const isReopening = !isEditingDate.value;
    isEditingDate.value = true;
    if (isReopening) {
      await nextTick();
      dateInput.value?.focus();
    }
    return false;
  }
};

// One write at a time. Two racing can reach the row in the opposite order
// to the picks, leaving the word on a date the reader already corrected and
// the screen showing the other one. A pick made mid-write waits its turn
// and supersedes any other pick still waiting, so holding an arrow key down
// in the picker costs two writes rather than one per step.
const saveSaidAt = async () => {
  if (isSaving) return;
  isSaving = true;
  let sent = '';
  while (sent !== requestedSaidAt) {
    sent = requestedSaidAt;
    const isSaved = await sendSaidAt(sent);
    if (!isSaved && sent === requestedSaidAt) {
      requestedSaidAt = '';
      break;
    }
  }
  isSaving = false;
};

// An emptied field is a half-typed date, not an instruction to unset one:
// every entry has a saidAt, and the column is not nullable.
const pickDate = async () => {
  const picked = candidateSaidAt.value;
  if (!picked || picked === requestedSaidAt) return;
  requestedSaidAt = picked;
  await saveSaidAt();
};

// Open on mount, per visit (spec §Behaviour): you came here for the story,
// and the fold is a reader's tool for a long one, not a gate.
const isStoryOpen = ref(true);

const router = useRouter();
const { notifyRemoved } = useEntryRemoval();

const actionsMenu = ref<{ focusTrigger: () => void } | null>(null);
const isConfirmOpen = ref(false);
const isDeleting = ref(false);
const hasDeleteError = ref(false);

const ALREADY_GONE = 404;

type DeleteOutcome = 'deleted' | 'signed-out' | 'failed';

const requestDelete = async (): Promise<DeleteOutcome> => {
  try {
    await $fetch(`/api/entries/${encodeURIComponent(entryId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return 'deleted';
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === UNAUTHORIZED) return 'signed-out';
    if (status === ALREADY_GONE) return 'deleted';
    console.error('[entry] delete failed', error);
    return 'failed';
  }
};

const leaveTheDeletedWord = async () => {
  const previous = router.options.history.state.back;
  if (typeof previous === 'string') {
    router.back();
    return;
  }
  await navigateTo('/feed', { replace: true });
};

const confirmDelete = async () => {
  if (isDeleting.value) return;
  isDeleting.value = true;
  hasDeleteError.value = false;

  const outcome = await requestDelete();

  if (outcome === 'signed-out') {
    try {
      await navigateTo('/login');
    } catch (error) {
      console.error('[entry] sign-in redirect failed', error);
      isDeleting.value = false;
      hasDeleteError.value = true;
    }
    return;
  }
  if (outcome === 'failed') {
    isDeleting.value = false;
    hasDeleteError.value = true;
    return;
  }

  notifyRemoved(entryId);
  try {
    await leaveTheDeletedWord();
  } catch (error) {
    // The word is gone; only the exit failed, so this must not report a
    // delete error.
    console.error('[entry] leaving the deleted word failed', error);
    isDeleting.value = false;
    isConfirmOpen.value = false;
  }
};

const cancelDelete = async () => {
  if (isDeleting.value) return;
  isConfirmOpen.value = false;
  hasDeleteError.value = false;
  // The ⋯ is still `disabled` until this render lands; focusing it before
  // then silently does nothing.
  await nextTick();
  actionsMenu.value?.focusTrigger();
};

const keptMediaKind = computed(() => {
  const kept = media.value;
  return kept && kept.status !== 'failed' ? kept.kind : null;
});

const { openForEdit, savedVersion, savedEntryId } = useCompose();

const editThisWord = () => {
  if (!entry.value) return;
  openForEdit(entry.value, media.value);
};

// Edit rises over this screen rather than navigating, so a save is reported
// rather than navigated back to: re-read in place and the scroll stays put.
watch(savedVersion, async () => {
  if (savedEntryId.value !== entryId) return;
  await refresh();
});

useHead(() => ({
  title: entry.value
    ? t('app.entry.pageTitle', { word: entry.value.word })
    : t('app.entry.pageTitleFallback'),
}));
</script>

<template>
  <!-- The bar carries the literal word "word" (spec §Metrics, detail.jsx),
       not the headword: the entry's own phrase is never truncated anywhere,
       and a 54px bar could only ellipsise it. It reads the same on the
       states below, where there is no entry to name. -->
  <NuxtLayout name="app-detail" :title="t('app.entry.barTitle')">
    <template v-if="entry" #bar-right>
      <EntryActionsMenu
        ref="actionsMenu"
        :disabled="isConfirmOpen"
        @edit="editThisWord"
        @delete="isConfirmOpen = true"
      />
    </template>

    <article v-if="entry" class="detail">
      <div class="detail__head">
        <VAvatar
          :name="speakerLead"
          :tone="entry.speaker?.tone ?? null"
          :size="52"
        />

        <p class="detail__meta">
          <span class="detail__meta-lead">{{ speakerLead }}</span
          ><span v-if="speakerRest" class="detail__meta-rest">{{
            speakerRest
          }}</span>
        </p>

        <!-- The ladder is an inline size, not a class: utils/headword-size.ts
             owns the steps and the feed card reads the same function, so the
             two screens shrink a long saying in lockstep. -->
        <h1 class="detail__word" :style="{ fontSize: `${headwordSize}px` }">
          <span class="detail__quote">“</span>{{ entry.word
          }}<span class="detail__quote">”</span>
        </h1>

        <p v-if="entry.gloss" class="detail__gloss">{{ entry.gloss }}</p>

        <!-- Inside the header stack, not below it: the voice is part of the
             word, not an attachment to it. -->
        <FeedMediaBlock
          v-if="media"
          class="detail__media"
          :media="media"
          :entry-id="entry.id"
          variant="big"
        />
      </div>

      <div v-if="entry.story" class="detail__unfold">
        <button
          type="button"
          class="detail__toggle"
          :aria-expanded="isStoryOpen"
          @click="isStoryOpen = !isStoryOpen"
        >
          <ChevronDown
            :size="16"
            class="detail__chev"
            :class="{ 'detail__chev--open': isStoryOpen }"
            aria-hidden="true"
          />
          {{
            isStoryOpen ? t('app.entry.storyHide') : t('app.entry.storyShow')
          }}
        </button>
        <p v-if="isStoryOpen" class="detail__story">{{ entry.story }}</p>
      </div>

      <!-- Read-only: collections are free text on the entry, and re-filing
           happens in edit. -->
      <div v-if="entry.collection" class="detail__collection">
        <span class="detail__chip">
          <Bookmark :size="14" aria-hidden="true" />{{ entry.collection }}
        </span>
      </div>

      <div class="detail__said">
        <button
          v-if="!isEditingDate"
          ref="dateTrigger"
          type="button"
          class="detail__said-body"
          @click="openDateEditor"
        >
          <Calendar :size="13" aria-hidden="true" />{{ saidLine }}
          <span class="detail__said-edit">{{
            t('app.entry.dateEdit.open')
          }}</span>
        </button>

        <div v-else class="detail__date">
          <input
            ref="dateInput"
            v-model="candidateSaidAt"
            type="date"
            class="detail__date-field"
            :max="maxSaidAt"
            :aria-label="t('app.entry.dateEdit.field')"
            @change="pickDate"
          />

          <i18n-t
            v-if="candidateAge"
            keypath="app.entry.dateEdit.aged"
            tag="p"
            class="detail__date-note"
          >
            <template #age>
              <b class="detail__date-age">{{ candidateAge }}</b>
            </template>
          </i18n-t>
          <p v-else class="detail__date-note">
            {{ t('app.entry.dateEdit.undated') }}
          </p>

          <p v-if="hasDateError" class="detail__date-error" role="alert">
            {{ t('app.entry.dateEdit.failed') }}
          </p>

          <button
            type="button"
            class="detail__date-done"
            @click="closeDateEditor"
          >
            {{ t('app.entry.dateEdit.done') }}
          </button>
        </div>
      </div>
    </article>

    <div v-else-if="stateCopy" class="detail__state">
      <span class="detail__state-icon" aria-hidden="true">
        <CircleAlert :size="30" />
      </span>
      <!-- The one line of copy IS the heading: a dead link must not land a
           screen-reader user on a page with no heading at all. -->
      <h1 class="detail__state-msg">{{ stateCopy }}</h1>
      <VButton
        v-if="failure === 'hiccup'"
        variant="secondary"
        size="sm"
        @click="retry"
      >
        {{ t('offline.tryAgain') }}
      </VButton>
    </div>

    <EntryDeleteSheet
      v-if="entry"
      :open="isConfirmOpen"
      :word="entry.word"
      :has-story="Boolean(entry.story)"
      :media-kind="keptMediaKind"
      :busy="isDeleting"
      :failed="hasDeleteError"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </NuxtLayout>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: var(--app-column);
  margin-inline: auto;
}

/* Centre-aligned column, gap 16 — the optical pulls (metaline -4, gloss -6,
   media +6) sit on the blocks themselves, not on this flow gap. */
.detail__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: var(--space-5) 0 var(--space-2);
  text-align: center;
}

/* One line, never wrapped (spec §Anatomy step 1) — so it must be clipped
   instead. Name and relation are 200 chars each server-side, and without a
   cap the nowrap line widens this centred column until the whole PAGE
   scrolls sideways on a phone. Same treatment as the top bar's title. */
.detail__meta {
  margin: -4px 0 0;
  max-width: 100%;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail__meta-lead {
  font-weight: var(--w-semibold);
  color: var(--ink);
}

.detail__meta-rest {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

/* Handwritten branch of the prototype's word style (app.jsx), same as the
   feed card: Caveat wants no negative tracking, a looser 1.2 leading, and
   bottom padding so its long descenders are not clipped. */
.detail__word {
  align-self: stretch;
  margin: 0;
  padding-bottom: 0.14em;
  font-family: var(--font-hand);
  font-weight: var(--w-semibold);
  line-height: 1.2;
  letter-spacing: 0;
  text-align: center;
  color: var(--ink);
  overflow-wrap: break-word;
}

.detail__quote {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

.detail__gloss {
  margin: -6px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-style: italic;
  color: var(--ink-2);
}

.detail__media {
  margin-top: 6px;
  width: 100%;
}

.detail__unfold {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 14px;
}

.detail__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--tap-min);
  padding: var(--space-2) var(--space-1);
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-semibold);
  color: var(--link);
  white-space: nowrap;
}

.detail__chev {
  transition: transform var(--dur-base) var(--ease-out);
}

.detail__chev--open {
  transform: rotate(180deg);
}

/* The one place centred body copy is right: the block is short, the page is
   a keepsake, and the column is built around the word's axis. */
.detail__story {
  margin: 6px 0 0;
  max-width: 330px;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--ink);
  text-align: center;
}

.detail__collection {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.detail__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: var(--r-sm);
  background: var(--surface-sunk);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: var(--w-semibold);
  color: var(--ink-2);
}

.detail__said {
  display: flex;
  justify-content: center;
  margin: 16px 0 0;
}

.detail__said-body {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: var(--space-2) 6px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
}

.detail__said-edit {
  font-weight: var(--w-semibold);
  color: var(--link);
}

.detail__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.detail__date-field {
  min-height: 44px;
  padding: 10px 12px;
  border: 1.5px solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: 15px;
  color: var(--ink);
  color-scheme: light dark;
}

/* Narrow on purpose (spec §Correcting the date): the sentence sits under
   the field as a caption, not as a full-width paragraph. */
.detail__date-note {
  margin: 0;
  max-width: 260px;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
  color: var(--ink-3);
  text-align: center;
}

.detail__date-age {
  font-weight: var(--w-semibold);
  color: var(--ink-2);
}

.detail__date-error {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--danger);
}

.detail__date-done {
  min-height: 40px;
  padding: var(--space-2) 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-semibold);
  color: var(--link);
}

/* Centred load failure, mirroring the feed's own state. */
.detail__state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-16) var(--space-6);
  text-align: center;
}

.detail__state-icon {
  display: inline-flex;
  color: var(--danger);
}

/* A heading by markup, a sentence by weight — it is the page's only line of
   copy, and shouting it would be the wrong voice for bad news. */
.detail__state-msg {
  margin: 0;
  max-width: 300px;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--w-regular);
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .detail__chev {
    transition: none;
  }
}
</style>
