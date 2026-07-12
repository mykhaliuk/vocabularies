// Vercel Ignored Build Step (vercel.json → ignoreCommand).
// Exit code semantics are inverted from intuition: 0 = SKIP the build,
// 1 = proceed with the build.
//
// Policy: always build main (production) and dev (the only preview branch
// with runtime env vars — see VKB-46). Any other branch builds only when
// its head commit message opts in with the "[preview]" marker.

const ALWAYS_BUILD_REFS = new Set(['main', 'dev']);
const PREVIEW_MARKER = '[preview]';

const ref = process.env.VERCEL_GIT_COMMIT_REF ?? '';
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '';

const shouldBuild =
  ALWAYS_BUILD_REFS.has(ref) || message.includes(PREVIEW_MARKER);

if (shouldBuild) {
  console.log(`vercel-ignore: building ref=${ref}`);
} else {
  console.log(
    `vercel-ignore: skipping ref=${ref} (no ${PREVIEW_MARKER} marker)`,
  );
}

process.exit(shouldBuild ? 1 : 0);
