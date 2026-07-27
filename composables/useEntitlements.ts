// The caller's rights as the client sees them (VKB-91, ADR-0012). Used ONLY to
// shape the affordance — which control to offer, which limits to state. It
// never authorizes: the server is the gate, every locked control is
// presentation, and a bypassed one still lands on 403 VIDEO_UPLOAD_FORBIDDEN.
//
// The numbers live server-side and are republished here, so nothing in the
// client restates a limit. While `entitlements` is null the caller must not
// invent defaults — a guessed cap that disagrees with the server would reject
// a file the server would have taken.
//
// useRequestFetch forwards the request's cookies during SSR (a bare $fetch to
// an internal route does not), so the shell renders with rights already known
// and the compose picker never flashes the wrong tier.
import type { MeResponse } from '~/server/utils/auth';
import type { Entitlements } from '~/server/utils/entitlements';

// Deliberately not awaited: awaiting would make every caller's setup async and
// drag a Suspense boundary into the app layout. The refs fill in on their own,
// and the only consumer — the compose picker — opens long after hydration.
export const useEntitlements = () => {
  const requestFetch = useRequestFetch();
  const { data, status } = useAsyncData('me:entitlements', () =>
    requestFetch<MeResponse>('/api/me'),
  );

  const entitlements = computed<Entitlements | null>(
    () => data.value?.entitlements ?? null,
  );
  const isLoaded = computed(() => entitlements.value !== null);
  const canUploadVideo = computed(
    () => entitlements.value?.videoUpload === true,
  );

  return { entitlements, isLoaded, canUploadVideo, status };
};
