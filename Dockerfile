# The public workbench: the exported client and the API in one Node process,
# with the pinned Python engines beside it. Built and started by Render from
# render.yaml; see docs/adr/0017-public-workbench-hosting.md.

FROM node:22-bookworm-slim

# uv provisions the Python version the engines pin (==3.12.*) and the locked
# environment at /app/.venv, which the engine supervisor expects.
COPY --from=ghcr.io/astral-sh/uv:0.12.17 /uv /usr/local/bin/uv

ENV NODE_ENV=production \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    UV_LINK_MODE=copy \
    POMSET_WORKBENCH_DATA=/app/.pomset-workbench

WORKDIR /app

# procps provides the `ps` that the storage layer uses to prove a supervisor's
# identity before it recovers an interrupted attempt; without it recovery refuses.
RUN apt-get update \
 && apt-get install -y --no-install-recommends procps openssl \
 && rm -rf /var/lib/apt/lists/* \
 && npm install --global pnpm@10 \
 && uv python install 3.12

COPY . .

RUN pnpm install --frozen-lockfile \
 && uv sync --frozen --no-dev \
 && pnpm run build \
 && mkdir -p "$POMSET_WORKBENCH_DATA" \
 && chown node:node "$POMSET_WORKBENCH_DATA"

USER node

CMD ["node", "apps/api/dist/bin/workbench.js"]
