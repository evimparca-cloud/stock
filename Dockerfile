# =============================================================================
# PRODUCTION DOCKERFILE - Multi-Stage Build
# Stock Management System - E-Commerce Admin Panel
# Optimized for: Security, Size, Performance
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Dependencies
# Node modüllerini cache'lemek için ayrı stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Package dosyalarını kopyala
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Dependencies kurulumu (production only)
RUN npm install --production && npm cache clean --force

# Prisma client oluştur
RUN npx prisma generate

# -----------------------------------------------------------------------------
# STAGE: Development
# Hot reload için
# -----------------------------------------------------------------------------
FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# STAGE 2: Builder
# Uygulamayı build etmek için
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Package dosyalarını kopyala
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Tüm dependencies'i kur (dev dependencies dahil)
RUN npm install && npm cache clean --force

# Prisma client oluştur
RUN npx prisma generate

# Tüm kaynak kodları kopyala
COPY . .

# Environment variables (build-time)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Sentry Auth Token for Source Maps
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

# Next.js build
RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 3: Runner
# Production runtime - Minimal imaj
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Non-root user oluştur
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Security: Gereksiz paketleri kaldır ve OpenSSL/Netcat ekle
# openssl: Prisma için gerekli
# netcat (nc): DB bağlantı kontrolü için gerekli
RUN apk add --no-cache curl dumb-init openssl libc6-compat netcat-openbsd

# Next.js standalone output kopyala
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Copy custom server wrapper and lib directory for cron jobs
COPY --from=builder /app/custom-server.js ./custom-server.js
COPY --from=builder /app/cron-init.js ./cron-init.js
COPY --from=builder /app/lib ./lib

# Copy cron dependencies from deps stage (not included in standalone)
COPY --from=deps /app/node_modules/node-cron ./node_modules/node-cron
COPY --from=deps /app/node_modules/cron-parser ./node_modules/cron-parser
COPY --from=deps /app/node_modules/uuid ./node_modules/uuid
COPY --from=deps /app/node_modules/node-fetch ./node_modules/node-fetch
COPY --from=deps /app/node_modules/data-uri-to-buffer ./node_modules/data-uri-to-buffer
COPY --from=deps /app/node_modules/fetch-blob ./node_modules/fetch-blob
COPY --from=deps /app/node_modules/formdata-polyfill ./node_modules/formdata-polyfill

# Security: Dosya sahipliği
RUN chown -R nextjs:nodejs /app

# Security: Non-root user'a geç
USER nextjs

# Environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/system/health || exit 1

# Port
EXPOSE 3000

# Graceful shutdown için dumb-init ve custom entrypoint kullan
ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]

# Start command - Use custom server for cron initialization
CMD ["node", "custom-server.js"]
