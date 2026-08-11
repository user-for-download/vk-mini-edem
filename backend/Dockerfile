# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/
COPY mini-app/package.json ./mini-app/

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY packages/contracts ./packages/contracts
COPY backend ./backend
COPY mini-app ./mini-app

RUN cd packages/contracts && npm run build
RUN cd backend && npx prisma generate && npm run build
RUN cd mini-app && npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

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
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/packages/contracts/dist ./node_modules/@edem/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./node_modules/@edem/contracts/
COPY --from=builder /app/mini-app/dist ./mini-app/dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
