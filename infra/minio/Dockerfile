# Builds the MinIO server and mc images that docker-compose.yml pins, from the
# upstream source at the exact commits of the releases VKB-170 pinned.
# See docs/adr/0021-self-built-minio-images.md and infra/minio/README.md.

FROM --platform=$BUILDPLATFORM golang:1.24.6-alpine@sha256:c8c5f95d64aa79b6547f3b626eb84b16a7ce18a139e3e9ca19a8c078b85ba80d AS build
RUN apk add --no-cache git
ARG TARGETOS
ARG TARGETARCH

ARG MINIO_COMMIT=07c3a429bfed433e49018cb0f78a52145d4bedeb
ARG MINIO_VERSION=2025-09-07T16:13:09Z
WORKDIR /src/minio
RUN git init -q \
  && git fetch -q --depth 1 https://github.com/minio/minio "$MINIO_COMMIT" \
  && git checkout -q FETCH_HEAD
# gen-ldflags runs for the build platform, so GOOS/GOARCH go on `go build` only.
RUN LDFLAGS="$(MINIO_RELEASE=RELEASE go run buildscripts/gen-ldflags.go "$MINIO_VERSION")" \
  && CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" \
     go build -tags kqueue -trimpath -ldflags "$LDFLAGS" -o /out/minio

ARG MC_COMMIT=7394ce0dd2a80935aded936b09fa12cbb3cb8096
ARG MC_VERSION=2025-08-13T08:35:41Z
WORKDIR /src/mc
RUN git init -q \
  && git fetch -q --depth 1 https://github.com/minio/mc "$MC_COMMIT" \
  && git checkout -q FETCH_HEAD
RUN LDFLAGS="$(MC_RELEASE=RELEASE go run buildscripts/gen-ldflags.go "$MC_VERSION")" \
  && CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" \
     go build -trimpath -ldflags "$LDFLAGS" -o /out/mc

# The server image carries mc too: compose's healthcheck is `mc ready local`.
FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8 AS minio
LABEL org.opencontainers.image.source=https://github.com/mykhaliuk/vocabularies
LABEL org.opencontainers.image.description="MinIO RELEASE.2025-09-07T16-13-09Z built from github.com/minio/minio@07c3a429bfed433e49018cb0f78a52145d4bedeb (AGPL-3.0)"
LABEL org.opencontainers.image.licenses=AGPL-3.0-only
COPY --from=build /out/minio /out/mc /usr/bin/
EXPOSE 9000 9001
ENTRYPOINT ["minio"]

FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8 AS mc
LABEL org.opencontainers.image.source=https://github.com/mykhaliuk/vocabularies
LABEL org.opencontainers.image.description="mc RELEASE.2025-08-13T08-35-41Z built from github.com/minio/mc@7394ce0dd2a80935aded936b09fa12cbb3cb8096 (AGPL-3.0)"
LABEL org.opencontainers.image.licenses=AGPL-3.0-only
COPY --from=build /out/mc /usr/bin/mc
ENTRYPOINT ["mc"]
