# ABOUTME: Production Dockerfile for Legal Lens frontend
# ABOUTME: Multi-stage build using Bun for deps/build, Node for runtime

# Dependencies stage - install all workspace dependencies
FROM oven/bun:1.3 AS deps
WORKDIR /app

# Copy workspace root files for proper resolution
COPY package.json bun.lock ./
COPY packages/types/package.json ./packages/types/
COPY frontend/package.json ./frontend/

# Install dependencies (includes workspace packages)
RUN cd frontend && bun install --frozen-lockfile

# Builder stage - build the Next.js application
FROM oven/bun:1.3 AS builder
WORKDIR /app

# Build arguments for Next.js public env vars (inlined at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_VIDEO_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# Make build args available as env vars during build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_VIDEO_URL=$NEXT_PUBLIC_VIDEO_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/packages ./packages

# Copy workspace root package.json for monorepo resolution
COPY package.json ./

# Copy source code
COPY frontend ./frontend
COPY packages/types ./packages/types

# Build the application
WORKDIR /app/frontend
RUN bun run build

# Runner stage - minimal Node.js runtime
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone output (monorepo structure puts it in frontend/ subdirectory)
COPY --from=builder /app/frontend/.next/standalone ./

# Copy static assets (not included in standalone output)
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000

# Run the Next.js server from the frontend subdirectory
CMD ["node", "frontend/server.js"]
