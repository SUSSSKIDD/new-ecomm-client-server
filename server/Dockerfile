# ─── Stage 1: deps ────────────────────────────────────────────────────────────
# Install ALL deps (including devDependencies needed for build) and cache them.
FROM node:20-alpine AS deps

WORKDIR /app

# Build tools required by native addons (sharp, bcrypt, etc.)
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./

# Mount npm cache so repeat builds are fast without baking the cache into the layer
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

COPY prisma ./prisma/
COPY prisma.config.ts ./

# Generate Prisma client (no URL needed at generate-time)
RUN npx prisma generate

COPY . .

RUN npm run build

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# openssl is required by Prisma at runtime; dumb-init fixes PID-1 signal handling
RUN apk add --no-cache openssl dumb-init

# Run as a non-root user — never run Node as root in production
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nodeuser

COPY package*.json ./

# Production-only deps; reuse the npm cache from the deps stage
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy generated Prisma client (both @prisma and .prisma)
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma

USER nodeuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# dumb-init as PID 1 forwards signals correctly to Node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--enable-source-maps", "dist/src/main"]
