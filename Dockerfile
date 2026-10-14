# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14 AS bun

FROM node:24-bookworm-slim AS dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY . .
ENV NITRO_PRESET=node-server
RUN bun run build

FROM dependencies AS database
COPY database ./database
COPY scripts ./scripts
COPY docker/entrypoint.mjs ./docker/entrypoint.mjs
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "docker/entrypoint.mjs"]
CMD ["bun", "run", "db:seed"]

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
COPY --chown=node:node docker/entrypoint.mjs ./docker/entrypoint.mjs
USER node
EXPOSE 3000
ENTRYPOINT ["node", "docker/entrypoint.mjs"]
CMD ["node", ".output/server/index.mjs"]
