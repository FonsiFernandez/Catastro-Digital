FROM node:24.19-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG INTERNAL_API_URL=http://api:8000
ARG NEXT_PUBLIC_USE_MOCK_CADASTRE=false

ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXT_PUBLIC_USE_MOCK_CADASTRE=$NEXT_PUBLIC_USE_MOCK_CADASTRE

RUN npm run build

FROM node:24.19-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]