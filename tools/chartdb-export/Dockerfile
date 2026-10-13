FROM mcr.microsoft.com/playwright:v1.64.0-noble
COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /workspace/tools/chartdb-export
COPY tools/chartdb-export/package.json tools/chartdb-export/bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY shared /workspace/shared
COPY tools/chartdb-export/*.mjs ./
CMD ["bun", "run", "server.mjs"]
