# Edem Current Memory

Updated: 2026-09-04

## Project

Edem is a VK Mini App for shared rides. It is an npm-workspaces TypeScript monorepo:

- `mini-app/`: React 19, VKUI v8, Vite, TanStack Query, Zustand, VK Bridge.
- `backend/`: Hono, Prisma 7 (`prisma.config.ts` + `@prisma/adapter-pg`, generated client in `src/generated/`), PostgreSQL, JWT/refresh auth, WebSocket notifications, admin API.
- `packages/contracts/`: shared Zod schemas and DTOs (incl. admin schemas).
- `webapp/`: admin panel — React 19, Vite 8 (port 3013), Tailwind 4, shadcn/ui, TanStack Router/Query.
- `e2e/`: full-cycle Playwright suite (`full-cycle.mjs`, 14 steps, driver→passenger flow).

## Runtime

- Local root `npm run dev` builds `packages/contracts` first, then starts frontend on `3010` and backend on `3011`.
- Admin panel: `npm run dev --workspace=webapp` on `3013`; its Vite proxy forwards `/api` to `:3011`, so admin cookies are same-origin. Production: the `webapp` service in `docker-compose.yml` (multi-stage `webapp/Dockerfile`: vite build → nginx) publishes port **3014** (`WEBAPP_BIND_ADDR` in root `.env`, default `127.0.0.1`); `webapp/nginx.conf` serves the SPA and proxies `/api` to `backend:3000` inside the docker network (same-origin httpOnly cookie).
- `VITE_API_TARGET` controls the Vite API/WebSocket proxy target.
- Production Docker backend listens on `3000` and serves `mini-app/dist`; the published bind address is configurable via `BACKEND_BIND_ADDR` in the root `.env` (default `127.0.0.1` for a same-host proxy, `0.0.0.0` for an external proxy plus firewall rules), while PostgreSQL is available only inside the Docker network.
- Production requires `DATABASE_URL`, `JWT_SECRET`, `VK_APP_SECRET`, and `CORS_ORIGINS`.
- `ALLOW_DEV_AUTH` is disabled in production and only supports local/test mock auth.
- Node >= 22 is required (`engines` in root `package.json`; CI and the Docker image both run Node 22). npm with `package-lock.json` is canonical; `bun.lock` was removed.

## Prisma (v7, upgraded 2026-09-04 from 5.22)

- Prisma 7.10: Rust engine gone, client is pure TS. `datasource.url` in schema.prisma is NOT supported — connection URL lives in **`backend/prisma.config.ts`** (`defineConfig` from `prisma/config`; `datasource.url = process.env.DATABASE_URL` with a placeholder fallback so `prisma generate` works without env, e.g. in Docker build; `migrations.path = prisma/migrations`; `migrations.seed = tsx prisma/seed.ts`). `.env` is NOT auto-loaded anywhere in v7 — the config loads `backend/.env` via explicit path (file-relative, not CWD); `seed.ts`/`drop-tables.ts` do the same; the app via `env.ts`.
- Generator: new `prisma-client` provider (ESM) → **`backend/src/generated/prisma`** (gitignored; compiled by tsc into `dist`; `scripts/format-check.mjs` ignores `generated/` dirs). ALL backend imports come from `.../generated/prisma/client.js` (NodeNext `.js` → `.ts` resolution; 19 files migrated off `@prisma/client`, which stays as the runtime package `@prisma/client/runtime/client`).
- Runtime connection: **`PrismaPg` driver adapter** in `src/db.ts` (`max: 10`, `connectionTimeoutMillis: 10_000` — node-pg IGNORES the old Rust-engine URL params `connection_limit`/`pool_timeout`/`schema`; `statement_cache_size` in CI URL is also a no-op). `log` option unchanged.
- v7 `migrate dev`/`db push` no longer auto-run `prisma generate`, and `@prisma/client` no longer auto-generates on install: scripts `db:migrate`/`db:push`/`db:push:force`/`db:test:push` chain `&& prisma generate`; root `npm run dev`/`npm run build` prepend `db:generate`. After a schema-changing `git pull` run `npm run db:generate`.
- **P2002 `meta` shape changed**: `meta.target` (index fields) is GONE; the pg driver data is at `meta.driverAdapterError.cause` (`originalCode: "23505"`, `kind: "UniqueConstraintViolation"`, `constraint.index` = the violated index NAME, e.g. `active_seat_booking`/`active_passenger_booking`). Classification of booking races is by constraint name via `getUniqueConstraintName()` in `src/utils/prisma-errors.ts` (used by POST /bookings and admin booking status override); other P2002/P2034 checks use only `error.code` (unchanged).
- Docker: stage 2 copies `backend/prisma.config.ts` to `/app`; `CMD` still `npx prisma migrate deploy && node dist/src/index.js` (verified: config loads, 15 migrations in image, validate OK without env).
- Prisma CLI has an AI-agent guard: `db push --accept-data-loss` invoked by an agent aborts until the user consents (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); human dev usage unaffected.
- Verified 2026-09-04: `prisma validate`, `db:push` (dev + test DBs, "already in sync"), `tsc --noEmit` all workspaces, backend suite 313/313 (edem_test), `npm run build`, dist-server smoke on Node 22 (health + GET /trips through adapter, clean shutdown), `docker build` + in-container validate, format:check.

## Authentication

- VK launch params are sent as the complete `searchParams` string.
- Backend verifies the `sign` HMAC and rejects stale `vk_ts` values older than five minutes.
- Client-provided `firstName`, `lastName`, and `photo` are not trusted identity data. They ARE used as display data on `/auth/vk`: the mini-app fetches the profile via VK Bridge `VKWebAppGetUserInfo` (3s timeout) and sends `firstName`/`lastName`/`photo` in the auth payload; VK launch params are a per-field fallback. Avatar is accepted only over https from VK CDN hosts (`*.userapi.com`, `*.vk.com`, `*.vk.ru`, `*.mvk.com`, `vk-cdn.ru`) and re-syncs on every login (not user-editable via API); name only replaces the `Пользователь VK <id>` placeholder, manually edited names (PATCH /users/me) are never overwritten. These fields are unsigned (VK signs only `vk_*` params), so they are display-only; identity and isVerified come from the signed `vk_user_id`.
- JWT access tokens are kept in the in-memory frontend API client.
- Refresh tokens are rotated and stored hashed in PostgreSQL. Rotation revokes the old token with a single atomic UPDATE (`revokedAt IS NULL` predicate), so exactly one concurrent rotation succeeds.
- Refresh token reuse detection: presenting an already-rotated token to `/auth/refresh` revokes ALL active tokens of that user (token family revocation). A repeated `/logout` with an old token does not revoke the family.
- Auth rate limits are configurable: `VK_AUTH_RATE_WINDOW_MS`/`VK_AUTH_RATE_MAX` (default 5/5min) and `REFRESH_RATE_WINDOW_MS`/`REFRESH_RATE_MAX` (default 10/10min). The old `AUTH_RATE_*` variables were removed.
- VK-authed = verified: `isVerified` defaults to `true` and `verifiedAt` is set on the `/auth/vk` upsert — the signed VK launch params ARE the verification. The manual verification flow was dropped: `User.verificationStatus`, `POST /me/request-verification`, the mini-app «Пройти верификацию» button, and the webapp «Верификация» column no longer exist (`verificationStatus` removed from `userSchema`/`adminUserDtoSchema`).

## Admin Panel

- Admin API lives under `/api/v1/admin` (backend/src/admin). Full endpoint reference: `docs/api/admin.md`.
- Login: `POST /auth/login` with the static `ADMIN_TOKEN` (timing-safe compare, wrong token → 401). Success sets httpOnly cookie `edem_admin_jwt` — a JWT signed with `JWT_SECRET`, claims `type=admin-access`, `sub=admin`, TTL `ADMIN_JWT_TTL_SECONDS` (default 43200 = 12h). No refresh tokens; expiry → re-login. The token is never exposed to JS (no localStorage). The `Secure` flag follows `X-Forwarded-Proto` (https → Secure, http → no Secure) so login works on HTTP-only domains behind a proxy; without the header it falls back to `isProduction`.
- `GET /auth/session` returns `{authenticated, expiresAt}` and is always 200 (the frontend cannot read the httpOnly cookie; TanStack Router `beforeLoad` guards admin routes with it). `POST /auth/logout` clears the cookie.
- Guarded endpoints return 401 without a valid session cookie; user access tokens (`type=access`) are rejected (type confusion).
- Closed by default: empty/unset `ADMIN_TOKEN` → 403 on ALL admin requests (incl. login) in every environment; no ephemeral dev fallback.
- Login is IP-rate-limited (`ADMIN_LOGIN_RATE_*`, default 5/5min, anti-bruteforce); in-memory buckets reset on backend restart.
- Admin powers: dashboard metrics; paginated users/trips/bookings/reviews; ban/unban; onboarding reset (`PATCH /users/:id/onboarding-reset` nulls `User.onboardingVersion`, idempotent, 404 for a missing user — the user sees the slides again on next launch); trip cancel (status only, no cascade; 409 for completed/cancelled trips); booking status override (Serializable tx, seat accounting restored/re-held, conflicts → 409); review moderation (approve/reject: `PATCH /reviews/:id/approve|reject` — pending→published / pending→rejected, 404 unknown, 409 non-pending; approve recomputes target rating/reviewsCount via shared `recomputeUserRating` in the same tx and notifies the author, reject does not recompute; notifications `review_approved`/`review_rejected` are non-critical, deep-link в «Мои отзывы»), `GET /reviews?status=` filter (list items include `status`); review delete (from any status; recomputes target rating/reviewsCount via shared `recomputeUserRating`); feedback list + reply (`GET /feedback`, `GET /feedback/:id`, `POST`/`PUT /feedback/:id/reply` — первичный ответ создаёт in-app уведомление `feedback_replied`; `repliedAt` — аудит первичного ответа, не двигается при правке); read-only settings snapshot.
- Ban: `User.bannedAt DateTime?` (migration `20260825142000_add_user_banned_at`) + `User.banReason String?` (migration `20260827120000_add_user_ban_reason`; `null` for pre-feature bans). Enforced on ALL auth paths: `/auth/vk` → 403 `{ code: "FORBIDDEN", message: "Account is banned", banReason }` after the upsert (covers real VK and dev-auth), no tokens issued + `revokeAllActiveTokens`; `/auth/refresh` → 403 with the same shape incl. `banReason` (regular and dev-mock branches) + revocation of active refresh tokens; `requireAuth` → 403; `optionalAuth` → treated as guest; WS auth → DB lookup closes the connection with 4403. Admin ban (`PATCH /users/:id/ban`) requires `{ reason }` (trim, 1–500 chars, strict schema; invalid → 400 VALIDATION_FAILED), persists `bannedAt` + `banReason` (idempotent re-ban overwrites both), and immediately closes the user's open WS connections (`wsManager.closeUserConnections`, 4403). Unban clears both `bannedAt` and `banReason`. Admin ban does NOT auto-cancel the user's trips. Admin user payload (`serializeAdminUser`/`adminUserDtoSchema`) includes `banReason: string | null`.
- Mini-app banned UX: auth status `banned` — bootstrap maps the 403 FORBIDDEN response (with `banReason`) to the ban screen in `AuthGate`: «Аккаунт заблокирован», «Причина: {banReason ?? "Причина не указана"}», единственная кнопка «Обратная связь» (открывает `FeedbackModal` с предзаполненной темой «Обжалование блокировки»). Mid-session ban: WS 4403 → refresh 403 → `apiClient.onBanned` event → immediate ban screen. Webapp bans via a modal with a required reason textarea (1–500, live counter) and shows `banReason` in the users list (fallback «Причина не указана»).
- Feedback appeal for banned users: `POST /api/v1/feedback/appeal` — публичный (без токена, забаненному токен не выдаётся): тело `{ searchParams, subject, text }` (feedbackAppealDtoSchema, searchParams ≤ 4096), личность подтверждается подписью VK launch-параметров через `verifyVkLaunchSignature` (как в `/auth/vk`, dev-sign при `ALLOW_DEV_AUTH` работает) — токены НЕ выдаются. Невалидная подпись → 401, пользователь не найден → 404, невалидное тело → 400 VALIDATION_FAILED; отдельный rate-limiter 5/час на IP (429). Обращение привязывается к `userId` — видно в админке (`GET /admin/feedback`). Mini-app: `useAuthStore.launchParams` хранит строку launch-параметров при бане; `useCreateFeedbackMutation` маршрутизирует: есть токен → `POST /feedback`, нет → appeal (нет токена и нет launchParams → ошибка-снэкбар без краша).
- Webapp auth flow: `/login` (single ADMIN_TOKEN input) → dashboard; api-client redirects to `/login` on any 401; sidebar «Выйти» logs out.

## Business Invariants

- Active booking statuses are `pending` and `confirmed`.
- Partial unique indexes prevent duplicate active seat and passenger bookings.
- Driver booking decisions allow only `pending -> confirmed|declined` before trip departure.
- Cancelled, declined, and confirmed bookings cannot be resurrected by the driver endpoint.
- Trip seat resizing validates occupied seat numbers inside a serializable transaction.
- Expired trip completion atomically claims an active trip before changing counters or sending side effects.
- Reviews are directional: passenger to driver or driver to confirmed passenger. Reviews are moderated: created `pending`, then admin-approved to `published` or rejected to `rejected` (409 on non-pending); the public list and the target's `rating`/`reviewsCount` count only `published` — recompute (same transaction) happens on approve and on delete, not on create.
- Public profiles omit license plates; public trip responses do not include exact meeting addresses at all. Trip details (`GET /trips/:id`) reveal full addresses only to participants: the driver and users with an active booking (pending/confirmed).
- Banned users (`bannedAt` set) are rejected with 403 on every authenticated endpoint; ban is enforced at login (`/auth/vk` → 403 with `banReason`, no tokens, active refresh tokens revoked), on `/auth/refresh` (403 with `banReason` + token revocation), `optionalAuth` (banned = guest), and WS auth (close 4403).
- Public trip search (`GET /trips`) excludes departed trips (`departureAt > now`); `GET /trips/my` still returns them so drivers can complete. Departure is a point of no return for trip edits (`PATCH /trips/:id` → 409 TRIP_IN_PAST), and changing departure time/duration rejects with 409 PASSENGER_BOOKING_OVERLAP if it would double-book a passenger's other active bookings.
- Manual trip completion notifies declined pending passengers (same notification + WS events as the auto-completion worker).
- Seat limits are uniform: input DTOs and response schemas both cap at `MAX_SEATS = 3` (no legacy tolerance — app is in development, no production data).
- User-input text DTOs (feedback subject/text, review text) trim before min-length validation — whitespace-only values are rejected.
- Production SPA fallback excludes the `/api` prefix: unknown API GETs return JSON 404, not index.html.

## VK Integration

- `VKWebAppInit` is fire-and-forget in `mini-app/src/main.tsx`.
- VKUI receives appearance, insets, adaptivity, platform, and WebView state through `AppConfig`.
- Session state reacts to browser visibility and VK view hide/restore events.
- WebSocket auth sends `{ type: "auth", token }` after connecting to `/api/v1/ws`; the token is not placed in the URL. The server closes authenticated connections when their access JWT expires.
- WebSocket contract (`packages/contracts`) matches the implementation: server sends `auth:ok`, `ping` (keep-alive), and business events; client sends only `auth` and `pong`. Dead `pong`/`error` server events, `wsPingSchema`, and a client `ping` variant were removed.
- WebSocket cleanup guards against stale sockets and reconnects after provider unmount.
- Swipe settings use `VKWebAppSetSwipeSettings`; raw swipe messages require a parent window and allowed VK origins.
- VK community messaging is optional. `VK_GROUP_TOKEN` is submitted to VK API in a POST body.
- Onboarding uses VK Bridge `VKWebAppShowSlidesSheet` (native information screens, max 10 slides, image 832×555 / 1.5:1 / ≤ 500 KB base64 `blob`, response `action`: confirm/reject(+slide_index)/cancel). The mini-app shows 3 slides once after first auth (`useOnboarding` in `App`, which renders inside `AuthGate`); ANY outcome marks onboarding done (VK recommends not re-pushing skipped onboarding). Done flag is backend-side: `User.onboardingVersion String?` (migration `20260827101541_add_user_onboarding_version`) — the client compares `user.onboardingVersion` with its own `ONBOARDING_VERSION` (`mini-app/src/onboarding/version.ts`, pure `shouldShowOnboarding` helper); bumping the constant re-shows the slides to all users once. Completion is `POST /api/v1/users/me/onboarding` (body `{version}`, trimmed string 1..50 chars); admins can reset the flag (`PATCH /api/v1/admin/users/:id/onboarding-reset` → null; webapp «Сбросить онбординг»). The former VK cloud storage helpers (`vkStorageGet`/`vkStorageSet`, `onboardingStorage.ts`) were removed. Slide images are placeholders in `mini-app/src/assets/onboarding/`, imported with Vite `?inline` (data-URL strings) and split into a lazy chunk to protect the initial-bundle gzip budget.

## Feedback (Обратная связь)

- Mini-app: Профиль → Помощь и поддержка → «Связаться с нами» → «Обратная связь» opens `FeedbackModal` (ModalPage styled like EditProfileModal: header + Group FormItems + sticky submit). Fields: «Тема» (≤ 100) and «Сообщение» (≤ 2000, live counter); limits come from `@edem/contracts` (`FEEDBACK_SUBJECT_MAX_LENGTH` / `FEEDBACK_TEXT_MAX_LENGTH`). Opened lazily via `openFeedbackModal` (helpers/feedbackModal.ts, `loadModule` pattern). External chat/report buttons still render if `VITE_SUPPORT_CHAT_URL` / `VITE_SUPPORT_REPORT_URL` are set.
- Backend: `POST /api/v1/feedback` (requireUser + mutationLimiter + DOMPurify + zod, trim before save, business event `feedback.created`); model `Feedback` (migration `20260826112025_add_feedback`, cascade delete with user, `createdAt desc` index) + `reply String?`/`repliedAt DateTime?` (admin answer, index on `repliedAt`).
- User: `GET /api/v1/feedback` (requireUser, bare array newest-first) returns the user's own submissions with `reply`/`repliedAt` (`UserFeedbackDto`); mini-app «Мои обращения» in SupportPanel + read-only detail modal (`useMyFeedbacksQuery`).
- Admin: paginated list `GET /api/v1/admin/feedback` (newest first, элемент включает `reply`/`repliedAt`) + detail card `GET /api/v1/admin/feedback/:id` + reply `POST`/`PUT /api/v1/admin/feedback/:id/reply` (первичный ответ создаёт in-app уведомление `feedback_replied`, deep-link в «Мои обращения»; `repliedAt` — аудит первичного ответа, не двигается при правке) + webapp master-detail page `/feedback`. Текст самого обращения в админке read-only (только ответ).
- Test DB note: `edem_test` is schema-synced via `prisma db push` (no `_prisma_migrations`); after new migrations run `npx dotenv -e .env.test -- npx prisma db push` in `backend/`.

## VK DM Button («Написать в VK»)

- Координация водитель↔пассажир через существующие ЛС VK (свой чат не строится). Кнопка «Написать в VK» появляется с момента брони (pending) и после подтверждения; открывает `https://vk.com/im?sel={vkUserId}` через `openExternalUrl` (`VKWebAppOpenUrl` + фолбэк). Подпись явно указывает, что переписка откроется во ВКонтакте. Хелпер `mini-app/src/helpers/vkLink.ts`: чистая `buildVkMessageUrl(vkUserId)` + `openVkMessages(vkUserId)`.
- Дозированная выдача `vkUserId` (fail-closed, по аналогии с адресами встречи): `userSchema.vkUserId?: positive int` (contracts). Сериализаторы получили опцию `includeVkUserId` (по умолчанию false; кладётся только при non-null). Включено: `GET /trips/:id` → driver.vkUserId при `canSeePrivateDetails`; `GET /bookings/my` → driver.vkUserId; `GET /bookings/trip/:tripId` → passenger.vkUserId (и так driver-only). НЕ отдаётся в поиск поездок, публичные профили, отзывы, `/bookings/history`.
- 4 UI-точки (только pending/confirmed + при наличии vkUserId): `TripDetailsPanel` (пассажир, рядом с «Отменить бронирование»), `PassengerTripCard` («Мои брони»), `BookingRequestRow` («Заявки» водителя), `TripPassengerRow` (подтверждённые пассажиры). Кнопки в карточках делают stopPropagation, чтобы не открывать детали/профиль.
- Без миграций БД (поле `User.vkUserId` уже существовало).

## VK Push Notifications (реальные push на ключевые события)

- Реальные push VK на ключевые события через `notifications.sendMessage` (серверный, **сервисный ключ** мини-аппа — не community-токен). Приходят при закрытом приложении, тап открывает нужный экран (deep-link по `fragment`). Отдельный механизм от сообщений сообщества (`messages.send`, `VK_GROUP_TOKEN`) — оба могут сосуществовать, у каждого своё разрешение.
- Ключевые события (=`CRITICAL_NOTIFICATION_TYPES`): `booking_status_changed` (подтверждение/отклонение → пассажиру), `trip_cancelled` (→ пассажирам), `trip_status_changed` (завершение → пассажирам + водителю; покрывает и автозавершение `tripWorker` без правки каждого call-site'а). Push подключён **внутри** `createNotification` для этих типов — автоматически покрывает бронирования, поездки и фоновый worker; к call-sites добавлен только `fragment` для deep-link.
- Backend `services/vkPush.ts`: `sendVkPush(vkUserId, message, fragment?)` — fail-safe (никогда не бросает), `Authorization: Bearer <VK_SERVICE_KEY>`, таймаут 8 с, версия API `5.199`. Без `VK_SERVICE_KEY` / при ошибке VK — push просто не отправляется, бизнес-флоу не ломается. Сообщество-сообщения и push — **два независимых** согласия; `notificationsEnabled` (тумблер) не влияет на критичные push (бизнес-контракт).
- Deep-link `fragment` = путь hash-маршрута мини-аппа (роутер `createHashRouter`): `/bookings` (бронь/отмена), `/bookings/history` (завершение → отзыв), `/trips/my` (водителю при автозавершении). Никаких изменений `parseDeepLink`/`deepLink.ts` — fragment попадает в hash, роутер обрабатывает.
- Mini-app: `bridge.requestNotificationsPermission()` (`VKWebAppAllowNotifications`, graceful `unsupported/cancelled/failed/success`). `NotificationsPanel`: чтение статуса из launch-параметра `vk_are_notifications_enabled` через `Promise.race` с таймаутом 3 с (паттерн как в `useAuthStore`, чтобы UI не зависал вне VK); баннер «Включить» или SimpleCell «Включены»; после успешного запроса — оптимистичное обновление.
- Внешнее (one-time): сервисный ключ из консоли VK (dev.vk.com → Настройки мини-аппа → Сервисный ключ) → `VK_SERVICE_KEY` в `backend/.env` / root `.env`. Секрет: как `JWT_SECRET`.
- Без миграций БД. Без новых WS-событий.

## City Directory (Справочник точек)

- **Зачем:** приложение для малого городка → конечный список населённых пунктов, которым управляет админ. UI мини-апа **не позволяет** вводить город вручную — только выбор из справочника. Место посадки (адрес) остаётся свободным текстом водителя.
- **25 точек Вологодской области засеяны в `prisma/seed.ts`** идемпотентным `seedCities()` (использует `findFirst` по `nameNormalized` + `create`/`update`). Повторный запуск seed НЕ пересоздаёт города и НЕ трогает админские правки.
- **Soft-reference паттерн:** `Trip.fromCity`/`toCity` остаются строками-снимками (источник правды для UI/поиска/уведомлений, не ломаем историю). Новые `Trip.fromCityId`/`toCityId` — nullable FK на `City` (ON DELETE SET NULL, денормализованный `City.tripsCount`). FK нужен для аналитики + autocomplete, но сервер на API смотрит на id.
- **DTO ужесточены:** `createTripDtoSchema` и `updateTripDtoSchema` теперь требуют `fromCityId`/`toCityId` (`z.string().uuid()`), с refine `fromCityId !== toCityId`. Старые клиенты без `fromCityId` → 400 VALIDATION_FAILED. Серверная валидация: при `findUnique` City 404 → 400 CITY_NOT_FOUND.
- **Backend:**
  - Публичный `GET /api/v1/cities/suggest?q=&limit=` (без auth, IP-limit 30/мин, Zod-валидация, `mode: "insensitive"` `contains`).
  - Админ `GET/POST/PATCH/DELETE /api/v1/admin/cities` (adminGuard, mutationLimiter). 409 на дубликат имени; 409 на удаление используемого города (`tripsCount > 0`).
  - `tripsCount` инкрементируется при создании Trip (внутри Serializable tx) и декрементируется при смене FK через PATCH (decrement old + increment new). Cancel не меняет счётчик (поездка остаётся в БД, FK валиден).
- **Contracts:** `city.schema.ts` + `city.dto.ts` с константами `CITY_NAME_MAX_LENGTH = 100`, `CITY_SUGGEST_LIMIT_MAX = 20` и `normalizeCityName`/`cityNameNormalized` хелперами. Уникальный индекс `City_nameNormalized_key` создаётся SQL-миграцией (Prisma не умеет в unique с выражением).
- **Mini-app:** новый `CityAutocomplete` компонент (VKUI `Input` + popup с `Cell`-списком, keyboard nav ↑/↓/Enter/Esc, click-outside, async typing). В `CreateTripModal`/`EditTripModal` поля «Откуда»/«Куда» заменены на `CityAutocomplete`, адреса остались свободным текстом. `useCityAutocompleteQuery` с `keepPreviousData` (без мигания), `staleTime: 60s`. `Trip` теперь включает `fromCityId`/`toCityId` (nullable, для pre-fill в EditTripModal).
- **Webapp:** новая страница `/cities` со списком (поиск с дебаунсом 300мс, пагинация), диалоги создания/переименования/удаления. Удаление заблокировано UI если `tripsCount > 0`. Sidebar: «Города» с `MapPin` иконкой. Lazy chunk: 88.96 kB / 24.38 kB gzip.

## City Picker + Locked Route (UX: CustomSelect, маршрут заблокирован в PATCH)

- **Поля «Откуда/Куда» реализованы на `CustomSelect`** (VKUI 8.4.0): дропдаун открывается прямо из поля, без третьего уровня модалки (форма → модалка → модалка — было UX-бредом). Один тап → дропдаун с поиском по подстроке, выбор → готово.
- **`CustomSelect` конфигурация:** `searchable` + `filterFn` (case-insensitive contains по `label`) + `renderOption` (CustomSelectOption с description) + `before={Icon20LocationMapOutline}` (контекстная иконка) + `placeholder` (имя выбранного) + `allowClearButton` (сброс).
- **Справочник грузится одним запросом** через `useAllCitiesQuery` (`staleTime: Infinity`, `gcTime: 30 мин`). Фильтрация — клиентская: для 25–200 городов O(N) на каждое нажатие — незаметно, и 1 запрос вместо N.
- **Backend: `citySuggestQuerySchema.q` стал опциональным.** Пустое/отсутствующее значение → возвращаем весь справочник. `CITY_SUGGEST_LIMIT_MAX` поднят с 20 до 100 (для клиентской загрузки всего списка).
- **`excludeCityId` prop в `CityPickerField`:** в `CreateTripModal` поле «Откуда» скрывает выбранный «Куда» (и наоборот) — UX-страховка от выбора того же города, плюс серверный refine `fromCityId !== toCityId`.
- **Текущий выбранный город помечен `disabled` в options** — пользователь видит свой выбор, но не может «пере-выбрать» его.
- **Маршрут ЗАБЛОКИРОВАН в `EditTripModal`:** поля `disabled=true` + helperText «Маршрут нельзя изменить после создания. Чтобы сменить, удалите поездку и создайте новую». Внизу форма — секция «Опасная зона» с кнопкой «Удалить поездку».
- **Кнопка «Удалить поездку»:** активна только если `trip.status === "active"` И нет активных броней (`pendingRequestsCount === 0 && confirmedBookingsCount === 0`). Использует `useCancelTripMutation` (`PATCH /trips/:id/cancel`) — единая точка отмены.
- **Backend отвергает смену маршрута в PATCH:** `updateTripDtoSchema = baseTripSchema.partial().omit({ fromCity, fromCityId, toCity, toCityId }).strict()`. Поля `fromCity`/`fromCityId`/`toCity`/`toCityId` в PATCH → 400. Бэкенд больше не резолвит FK и не декрементит `tripsCount` в PATCH — этот код удалён.
- **UX-обоснование «только удалить»:** подтверждённые пассажиры уже запланировали поездку. Смена маршрута после подтверждения = обман. Единственный безопасный путь — отмена текущей и создание новой.
- **Бандл: 271 KiB initial gzip** (было 316 — минус 45 KiB: выкинули `CityAutocomplete`, `CityPickerModal`, убрали зависимости). Под лимитом 330 KiB.
- **Без миграций БД.** Без новых WS-событий. Без изменений `tripWorker`.

## Review Moderation (модерация отзывов + лимит 150)

- **State machine:** `pending --approve--> published` (публичный, входит в рейтинг) / `pending --reject--> rejected` (скрыт, не в рейтинге). Approve/reject — только из `pending`, иначе `409 CONFLICT`. `DELETE` — из любого статуса (без изменений). Новый отзыв = `pending`.
- **Published-only:** публичный `GET /reviews/user/:userId` — только `published`. `recomputeUserRating` агрегирует `where { targetUserId, status: "published" }`; вызывается при **одобрении** (Serializable tx — статус и агрегат меняются атомарно) и при **удалении**, но **не** при создании — pending-отзыв рейтинг не меняет.
- **Лимит 150:** `REVIEW_TEXT_MAX_LENGTH = 150` (contracts) enforced на запись — `createReviewDtoSchema.text` `.trim().min(1).max(150)`. Read-схема `reviewSchema.text` намеренно остаётся `max(1000)` (терпимая, fail-closed для существующих отзывов).
- **Admin:** `PATCH /reviews/:id/approve` (pending→published + recompute + in-app уведомление `review_approved` «Отзыв опубликован») и `PATCH /reviews/:id/reject` (pending→rejected, **без** recompute, уведомление `review_rejected` «Отзыв отклонён»); 404 — не найден, 409 — не pending. Уведомления не критичные (подчиняются тумблеру `notificationsEnabled`), deep-link `/profile?panel=reviews` → «Мои отзывы». `GET /reviews?status=pending|published|rejected` — опциональный фильтр; `AdminReviewDto` включает `status`.
- **Mini-app:** `ReviewCard` — полный текст в multiline `SimpleCell`, **Popover удалён** (и chevron); `extraSubtitle`-подпись («На модерации»/«Отклонён») только при `status !== "published"` (публичные списки получают только published → подпись не видна). `CreateReviewModal` — лимит 150 из contracts, счётчик `N/150` (красный за 50 до лимита), success-снэкбар «Отзыв отправлен на модерацию». `ProfilePanel` — секция «Мои отзывы»: `useMyReviewsQuery` → `GET /reviews/my` (теперь с `status`), до 3 последних (`MY_REVIEWS_LIMIT = 3`).
- **Webapp:** `ReviewsPage` — колонка «Статус» (бейджи: pending amber, published green, rejected red), «Одобрить»/«Отклонить» для pending, фильтр по статусу; мутации инвалидируют `["admin","reviews"]` + `["admin","dashboard"]` (sonner-тосты).
- **DB:** `Review.status String @default("pending")` + `@@index([targetUserId, status])`, миграция `20260903090000_add_review_status`; существующие отзывы backfill'ены в `published` (рейтинг не меняется).
- **Дедупликация status-independent:** `GET /reviews/available-trips` и unique-индекс `[authorId, tripId, targetUserId]` блокируют повторный отзыв независимо от статуса — pending-отзыв тоже считается «уже оставленным».

## Verification

Verified on 2026-09-03 after the review moderation + 150-char limit feature:

- `npm run typecheck` passed for all workspaces (contracts, backend, mini-app, webapp).
- `npm test`: contracts 192/192 (was 161 → +31), backend 312/312 (was 295 → +17: `review-moderation.test.ts` + additions to existing suites), mini-app 110/110 (was 97 → +13: `ReviewCard`/`CreateReviewModal`).
- `npm run build` passed (mini-app + webapp).

Verified on 2026-09-01 after the city directory + autocomplete feature:

- `npm run typecheck` passed for all workspaces (contracts, backend, mini-app, webapp).
- `npm run lint` (mini-app eslint) passed; `npm run format:check` passed.
- `npm test`: contracts 151/151 (was 119 → +32: `city.schema.test.ts` + 3 trip cityId теста), backend 291/291 (was 269 → +22: `cities-suggest.test.ts` + `admin-cities.test.ts` + `trip-city-id.test.ts`), mini-app 94/94 (was 92 → +2: `cities.api.test.ts`).
- `npm run build` for mini-app and webapp succeeded. Webapp cities lazy chunk: 88.96 kB / 24.38 kB gzip. Mini-app bundle: 316.2 KiB initial gzip (≤ 330 KiB limit).
- 25 городов Вологодской области в `edem` dev DB после `npm run db:seed`; повторный запуск seed идемпотентен.

Verified on 2026-09-01 after the City Picker + Locked Route feature (rework to CustomSelect):

- `npm run typecheck` passed for all workspaces.
- `npm run lint` (mini-app eslint) passed; `npm run format:check` passed.
- `npm test`: contracts 161/161 (was 151 → +10: `update-trip.dto.test.ts` 9 тестов, `city.schema.test.ts` обновлены 3 «accept empty/missing q»), backend 295/295 (was 291 → +4: PATCH-fromCityId/toCityId/fromCity-string → 400, PATCH-non-route-fields → 200 в `trip-city-id.test.ts`; +1 cities-suggest «empty q → 200 full directory»; +1 lifecycle test fix), mini-app 95/95 (was 94 → +1: «пустой q → весь справочник» в `cities.api.test.ts`).
- `npm run build` mini-app succeeded. Initial gzip 271.03 KiB (минус ~45 KiB от старого решения с ModalPage+Modal). Под лимитом 330 KiB. `CityPickerField` теперь внутри lazy-чанков `CreateTripModal`/`EditTripModal`, отдельный `CityPickerModal` чанк удалён.
- 25 городов по-прежнему в БД.
- e2e full-cycle: тот же pre-existing flake на шаге 3 «Создание поездки» (date-picker / создание машины), не связан с этим фичем.

Verified on 2026-08-28 after the VK push notifications feature (`notifications.sendMessage` for critical events):

- `npm run typecheck` passed for all workspaces (mini-app, backend, contracts, webapp).
- Backend tests: 248 passed (incl. 12 new: 7 `vkPush.test.ts` + 5 `notification-push.test.ts`).
- Contracts tests: 100 passed.
- Mini-app tests: 89 passed (incl. 5 new in `bridge.test.ts` for `requestNotificationsPermission`).
- `npm run lint` passed; `npm run format:check` passed; `npm run bundle:check` passed; `npm run build` passed.

Verified on 2026-08-28 after the VK DM «Написать в VK» button (driver↔passenger via vk.com/im?sel={vkUserId}):

- `npm run typecheck` passed for all workspaces (mini-app, backend, contracts, webapp).
- Backend tests: 236 passed (incl. 10 new `vk-dm-disclosure.test.ts`).
- Contracts tests: 100 passed (incl. 4 new `vkUserId` tests in `user.schema.test.ts`).
- Mini-app tests: 84 passed (incl. 11 new: `vkLink.test.ts` — 3, `vkWriteButton.test.tsx` — 8).
- `npm run lint` passed; `npm run bundle:check` passed (311.2 KiB initial gzip); `npm run build` passed.
- `npm run format:check` passed after removing two legacy trailing-whitespace lines in `backend/src/bookings/index.ts` (they shifted from the baselined 624/805 to 626/807 because this feature added lines above) and deleting their `legacyTrailingWhitespace` entries in `scripts/format-check.mjs`. Note: `backend/src/trips/index.ts:516` baseline entry is now stale (no trailing whitespace left in that file) but harmless.

Verified on 2026-08-28 after the ban-feedback-appeal feature (ban screen «Обратная связь» + public appeal endpoint):

- `npm run format:check` passed.
- Backend tests: 226 passed (incl. 17 new `feedback-appeal.test.ts`).
- Contracts tests: 96 passed (incl. 13 new `feedbackAppealDtoSchema` tests).
- Mini-app tests: 73 passed (incl. 10 new: `useFeedbackQuery.test.ts`, `feedbackModal.test.ts`, `AuthGate.test.tsx`).

Verified on 2026-08-28 after the ban-reason feature (ban reason + banned-user screen):

- `npm run format:check` passed.
- Backend tests: 209 passed (incl. new `auth-ban-reason.test.ts` and `admin-ban-reason.test.ts` — 25 new tests).
- Contracts tests: 83 passed (incl. 18 new `admin.schema.test.ts` tests).
- Mini-app tests: 63 passed (incl. 15 new: `useAuthStore.test.ts`, `client.test.ts` extensions).

Verified on 2026-08-27 after the full logic-bug remediation (21 fixes, see CHANGELOG "Bugfix Remediation (2026-08-27)"):

- `npm run typecheck` passed for all workspaces (contracts, backend, mini-app, webapp).
- Contracts tests: 52 passed (incl. whitespace-trim tests for feedback/review DTOs and seat-cap schema tests).
- Backend tests: 172 passed (incl. new regression suites: `ban-enforcement.test.ts` — 5, `admin-moderation.test.ts` — 11, `trips-search-departed.test.ts` — 2).
- Mini-app tests: 58 passed.
- Mini-app ESLint, format check, and bundle budget passed (310.8 KiB initial gzip, ≤ 330 KiB limit).

Previous verification (2026-08-26, feedback form):

- `npm run typecheck` passed for all workspaces (contracts, backend, mini-app, webapp).
- Contracts tests: 41 passed (incl. 13 feedback schema tests).
- Backend tests: 154 passed (incl. `feedback.test.ts` — 9 tests: auth/validation/trim/sanitize; `admin-feedback.test.ts` — 6 tests: guard, pagination, ordering; `admin-auth` integration suite, 18 tests).
- Mini-app tests: 58 passed (incl. `feedback.api.test.ts`).
- Webapp production build passed (also builds inside the multi-stage Docker image).
- Mini-app production build passed; FeedbackModal is a lazy chunk and `scripts/check-bundle.mjs` budget passes (310.8 KiB initial gzip, ≤ 330 KiB limit).
- ESLint and format check passed.
- Admin runtime flow verified via curl (login → Set-Cookie httpOnly/SameSite=Lax/Max-Age=43200 → guarded 200 → logout clears cookie) and Playwright on `:3013` (13/13: redirects, wrong-token error, login, live data, logout, session persistence per browser context).
- Production compose verified: `docker compose up -d --build` brings up `db` + `backend` + `webapp` (all healthy); `:3014` serves the SPA (root and client-route fallback both 200) and proxies `/api/v1/admin/*` to the backend; login through `:3014` sets the cookie and the session/dashboard respond 200.
- Full-cycle E2E `e2e/full-cycle.mjs`: 14/14 steps passed (driver→passenger flow).
- Admin login rate limiter confirmed live: 6th attempt within 5 minutes → 429.

Remaining production limitation: rate limiting and WebSocket fan-out are process-local and require Redis/pub-sub for horizontally scaled backend instances. See the production limitations section in `README.md`.

The production frontend passes the enforced initial and per-chunk gzip budgets; route and vendor splitting remain in place.

## Documentation Rules

When behavior changes, update this file and the relevant README/API document in the same change. Keep commands and ports synchronized with the root `package.json`, and document security-sensitive behavior from the implementation rather than old plans.
