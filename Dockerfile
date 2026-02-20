# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build tools for native dependencies if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies for build
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install FFMPEG for media processing in production
# Also install openssl for Prisma
RUN apk add --no-cache ffmpeg openssl

ENV NODE_ENV=production
ENV PORT=3000

# Copy package.json and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm install dotenv

# Copy built artifacts from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY prisma.config.ts ./

# Expose port
EXPOSE 3000

# Start application (runs migrations first, then starts fastify)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
