// Vercel Ignored Build Step (vercel.json → ignoreCommand).
// Exit code semantics are inverted from intuition: 0 = SKIP the build,
// 1 = proceed with the build.
//
// Policy: always build main (production) and dev (the only preview branch
// with runtime env vars — see VKB-46). Any other branch builds only when
// the head commit SUBJECT (first line) ends with the "[preview]" marker,
// case-insensitively. The marker is anchored to the end of the subject so
// incidental mentions — revert subjects quoting an opted-in commit, squash
// bodies, prose about the marker itself — do not trigger builds. The check
// runs per push: a follow-up commit without the marker skips again, leaving
// the previously built preview stale.

const ALWAYS_BUILD_REFS = ['main', 'dev'];
const PREVIEW_MARKER = '[preview]';

const ref = process.env.VERCEL_GIT_COMMIT_REF ?? '';
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '';
const subject = message.split('\n', 1)[0].trim().toLowerCase();

const shouldBuild =
  ALWAYS_BUILD_REFS.includes(ref) || subject.endsWith(PREVIEW_MARKER);

if (shouldBuild) {
  console.log(`vercel-ignore: building ref=${ref}`);
} else {
  console.log(
    `vercel-ignore: skipping ref=${ref} (no ${PREVIEW_MARKER} suffix)`,
  );
}

process.exit(shouldBuild ? 1 : 0);
