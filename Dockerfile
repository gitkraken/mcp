# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl git unzip \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app /workspace /tmp/gk-home \
    && chown node:node /app \
    && chmod 1777 /workspace /tmp/gk-home \
    && git config --system --add safe.directory '*'

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./

USER node

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --omit=dev

ARG TARGETARCH
ARG GK_CORE_VERSION=3.1.74

RUN case "${TARGETARCH}" in \
        amd64) \
            gk_platform_arch=x64; \
            gk_archive_arch=amd64; \
            gk_archive_sha256=156c4265a97f59f60bbeaa67849e57431d7e08435a42b1eddf8d7b73ef8ed35d \
            ;; \
        arm64) \
            gk_platform_arch=arm64; \
            gk_archive_arch=arm64; \
            gk_archive_sha256=80700a1907a9e452e224540ac4b21f7e755ff9748bcbb959418a70c53f581ccb \
            ;; \
        *) \
            echo "Unsupported Docker architecture: ${TARGETARCH}" >&2; \
            exit 1 \
            ;; \
    esac \
    && gk_archive=/tmp/gk-core.zip \
    && curl --fail --location --show-error \
        "https://api.gitkraken.dev/releases/gkcli/production/linux/${gk_platform_arch}/${GK_CORE_VERSION}/gk_core_${GK_CORE_VERSION}_linux_${gk_archive_arch}.zip" \
        --output "${gk_archive}" \
    && echo "${gk_archive_sha256}  ${gk_archive}" | sha256sum --check --strict \
    && unzip -o "${gk_archive}" -d /app/node_modules/@gitkraken/gk/bin \
    && rm "${gk_archive}" \
    && /app/node_modules/.bin/gk version

RUN /app/node_modules/.bin/gk mcp --list-tools --no-telemetry > /dev/null

ENV HOME=/tmp/gk-home \
    XDG_CACHE_HOME=/tmp/gk-home/.cache \
    XDG_CONFIG_HOME=/tmp/gk-home/.config \
    XDG_STATE_HOME=/tmp/gk-home/.local/state

WORKDIR /workspace

LABEL io.modelcontextprotocol.server.name="com.gitkraken/gk-cli"

ENTRYPOINT ["/app/node_modules/.bin/gk", "mcp", "--host=docker"]
