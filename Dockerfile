# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates git \
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

RUN /app/node_modules/.bin/gk mcp --list-tools --no-telemetry > /dev/null

ENV HOME=/tmp/gk-home \
    XDG_CACHE_HOME=/tmp/gk-home/.cache \
    XDG_CONFIG_HOME=/tmp/gk-home/.config \
    XDG_STATE_HOME=/tmp/gk-home/.local/state

WORKDIR /workspace

LABEL io.modelcontextprotocol.server.name="com.gitkraken/gk-cli"

ENTRYPOINT ["/app/node_modules/.bin/gk", "mcp", "--host=docker"]
