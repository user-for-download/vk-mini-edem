# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/

RUN npm ci || npm install

COPY tsconfig.json ./
COPY packages/contracts ./packages/contracts
COPY backend ./backend

RUN cd packages/contracts && npm run build
RUN cd backend && npx prisma generate && npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/packages/contracts/dist ./node_modules/@edem/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./node_modules/@edem/contracts/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
