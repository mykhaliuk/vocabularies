# MinIO images

`docker-compose.yml` (local `infra:up` and CI's `e2e-authed`) pulls MinIO and
mc from `ghcr.io/mykhaliuk/*`, built here from upstream source. Why:
[ADR-0021](../../docs/adr/0021-self-built-minio-images.md).

| Image                     | Release                      | Source commit                                          |
| ------------------------- | ---------------------------- | ------------------------------------------------------ |
| `ghcr.io/mykhaliuk/minio` | RELEASE.2025-09-07T16-13-09Z | `minio/minio@07c3a429bfed433e49018cb0f78a52145d4bedeb` |
| `ghcr.io/mykhaliuk/mc`    | RELEASE.2025-08-13T08-35-41Z | `minio/mc@7394ce0dd2a80935aded936b09fa12cbb3cb8096`    |

The server image also carries `mc`, because the compose healthcheck is
`mc ready local`.

## Verify

`--version` prints the release tag and the commit the binary was built from:

```sh
docker run --rm ghcr.io/mykhaliuk/minio:RELEASE.2025-09-07T16-13-09Z --version
docker run --rm ghcr.io/mykhaliuk/mc:RELEASE.2025-08-13T08-35-41Z --version
```

## Rebuild or bump

Bump the `*_COMMIT` / `*_VERSION` args in the `Dockerfile` (keep both moving
together, per VKB-170), then build both architectures and push. This needs a
token with `write:packages` on the owner account:

```sh
cd infra/minio
docker buildx create --name minio-images --driver docker-container --use
docker buildx build --platform linux/amd64,linux/arm64 --target minio \
  -t ghcr.io/mykhaliuk/minio:<RELEASE> --push .
docker buildx build --platform linux/amd64,linux/arm64 --target mc \
  -t ghcr.io/mykhaliuk/mc:<RELEASE> --push .
```

Pin the pushed index digests (`docker buildx imagetools inspect <ref>`) in
`docker-compose.yml`. A new package is private until its visibility is set to
**Public** in its GitHub settings; CI pulls anonymously.

Before pinning, re-run `minio-init` twice against a fresh volume and check it
exits 0 both times: its `set -e` depends on mc being idempotent in that
release.
