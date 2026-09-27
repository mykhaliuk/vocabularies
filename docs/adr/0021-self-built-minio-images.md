# ADR-0021: MinIO images are built from source and hosted on GHCR

- Status: Accepted
- Date: 2026-09-27
- Refs: VKB-193, VKB-189, VKB-170, VKB-126, VKB-115, `infra/minio/`,
  `docker-compose.yml`

## Context

The authed e2e suite runs against a real S3 server (VKB-115): presigned PUT and
GET, `HeadObject` on confirm, the transcode reading one bucket and writing
another, and per-bucket scoped credentials (VKB-126). Local `infra:up` and CI's
`e2e-authed` both get that server from `docker-compose.yml`, pinned to exact
MinIO and mc releases (VKB-170).

MinIO stopped distributing the community edition's builds, one channel at a
time:

- 2026-09-11: `minio/minio` and `minio/mc` vanished from Docker Hub (VKB-189);
  the pins moved to `quay.io/minio/*`, same digests.
- By 2026-09-26: the quay repositories require authentication as a whole
  (401 on the API, no tag pullable), and `dl.min.io` answers 410 Gone for the
  pinned release binaries.

Each time, every `e2e-authed` job and every fresh `infra:up` failed, while
machines with cached images kept working.

The source stays public on GitHub under AGPL-3.0, at the commits the pinned
binaries report (`minio --version`).

## Decision

**Build the two images ourselves from the pinned source commits and host them
on GHCR under the repo owner, pinned by digest.**

- `infra/minio/Dockerfile` builds MinIO and mc from `github.com/minio/*` at
  the exact commits of the VKB-170 releases, with upstream's own ldflags
  script, so the binaries report the same release tag and commit id. It
  produces `linux/amd64` and `linux/arm64` (CI and the owner's machine).
- The images are public packages at `ghcr.io/mykhaliuk/{minio,mc}`, and
  `docker-compose.yml` pins them by tag and digest.

## Alternatives rejected

- **Mock S3 in the suite.** It removes the coverage VKB-115 added: a mock
  accepts any signature and cannot fail on a credential mix-up, the two
  failures that suite exists to catch.
- **Push the cached upstream images to GHCR.** Byte-identical, but the cache
  holds only the arm64 layers of the multi-arch index; CI runs amd64.
- **Another public mirror.** None carries the pinned digests
  (`mirror.gcr.io` has no such manifest), and it would be the same class of
  third-party dependency that has failed twice.
- **Replace MinIO** (SeaweedFS, Garage). A viable path if MinIO's source goes
  too. It is a larger change today: `minio-init` provisions the scoped users
  with `mc admin`, which would have to be re-expressed.

## Consequences

- The images are not byte-identical to upstream's. They are built from the
  same source at the same commits and report the same release and commit id.
- A bump is a local rebuild and push by someone with `write:packages` on the
  owner account (`infra/minio/README.md`), not a one-line tag edit.
- No upstream security fixes arrive for the community edition either way. That
  is acceptable for a local and CI-only server that holds throwaway test
  data.
- A new package is private by default and must be made public by hand, once.
