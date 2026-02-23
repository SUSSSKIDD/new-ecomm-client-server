# ── Stage 1: Build + prune ──────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install ALL deps (dev + prod) once
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci --prefer-offline && npx prisma generate

# Compile TypeScript
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/
RUN npm run build

# Strip dev deps + build-only packages not needed at runtime
RUN npm prune --omit=dev && \
    rm -rf src tsconfig*.json nest-cli.json \
    node_modules/prisma \
    node_modules/typescript \
    node_modules/effect \
    node_modules/@prisma/studio-core \
    node_modules/@prisma/engines \
    node_modules/@prisma/fetch-engine \
    node_modules/@prisma/get-platform \
    node_modules/@prisma/dev

# ── Stage 2: Production image ──────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S app && \
    adduser -S app -u 1001

WORKDIR /app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

ENV NODE_ENV=production
ENV PORT=3000

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
