# ─── Stage 1: Build ──────────────────────────────────────────────────────────
# Node 22 — совпадает с CI (.github/workflows/ci.yml) и engines в package.json.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/
COPY mini-app/package.json ./mini-app/
# webapp в image не собирается, но его package.json нужен npm ci:
# корневой package.json объявляет workspace "webapp", без него установка падает.
COPY webapp/package.json ./webapp/

# IPv4-first: LAN-DNS отдаёт registry.npmjs.org в AAAA-первых,
# а IPv6 в контейнерах сборки — blackhole (нет маршрута).
# --maxsockets=2: сеть провайдера троттлит npm-registry при параллельных сокетах
# (15 по умолчанию → зависание на 15+ мин); с 2 сокетами npm ci идёт ~40с.
RUN NODE_OPTIONS=--dns-result-order=ipv4first npm ci --maxsockets=2

COPY tsconfig.json ./
COPY packages/contracts ./packages/contracts
COPY backend ./backend
COPY mini-app ./mini-app

RUN cd packages/contracts && npm run build
RUN cd backend && npx prisma generate && npm run build
RUN cd mini-app && npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=builder /app/backend/dist ./dist
# В npm workspaces ВСЕ пакеты поднимаются в корневой node_modules;
# backend/node_modules содержит только symlink'и — копировать его поверх нельзя.
COPY --from=builder /app/node_modules ./node_modules

# @hono/node-ws npm 10 кладёт вложенно в workspace (из-за peerDependencies),
# а рантайм резолвит из /app/node_modules — копируем его точечно.
COPY --from=builder /app/backend/node_modules/@hono/node-ws ./node_modules/@hono/node-ws
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/packages/contracts/dist ./node_modules/@edem/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./node_modules/@edem/contracts/
COPY --from=builder /app/mini-app/dist ./mini-app/dist

# The application does not need root privileges at runtime.
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
