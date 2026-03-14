# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies needed for node-gyp and Prisma
RUN apk add --no-cache python3 make g++ openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build application
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts and Prisma configuration from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE $PORT

CMD ["npm", "run", "start:prod"]
