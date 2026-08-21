# Edem — Сервис попутных поездок (VK Mini App)

Монорепозиторий проекта **Edem** (аналог BlaBlaCar для VK Mini Apps). Приложение позволяет водителям предлагать поездки, а пассажирам — бронировать места, оставлять отзывы и просматривать историю своих поездок.

## 🌟 Основные возможности

- **Поиск поездок**: поиск с фильтрацией по городам, дате, цене и тегам, offset-пагинация (`page`/`limit`); собственные поездки исключаются из выдачи (при пустой странице клиент догружает следующие).
- **Создание поездок**: для водителей с указанием цены, количества мест, тегов и комментария.
- **Бронирование мест**: пассажиры бронируют места в активных поездках; защита от гонки броней на уровне БД (partial unique index + Serializable-транзакции).
- **Заявки пассажиров**: водитель подтверждает или отклоняет заявки, место удерживается в статусе `pending`.
- **Отзывы и рейтинги**: система рейтингов водителей и пассажиров, отзывы после начала или завершения поездки в обе стороны (пассажир → водитель и водитель → пассажир).
- **Уведомления**: встроенные уведомления + WebSocket-пуши (новая заявка, статус брони, отмена поездки).
- **Управление автомобилями**: добавление и редактирование информации об авто для водителей.
- **Интеграция с VK**: авторизация через подписанные launch params VK, имитация только в Dev/Test, VKUI, WebSocket и опциональные сообщения от имени сообщества.

## 📁 Структура монорепозитория

```edem/
├── mini-app/                    # Frontend: React + VKUI + Vite (Service Worker отключён для VK WebView)
│   ├── public/                  # Иконки PWA
│   ├── src/
│   │   ├── api/                 # HTTP-клиент (таймауты, Zod-валидация ответов) + API-запросы
│   │   ├── components/          # Компоненты интерфейса (+ ErrorBoundary, ViewErrorBoundary)
│   │   ├── hooks/               # Кастомные React-хуки
│   │   ├── panels/              # Панели навигации (VKUI)
│   │   ├── modals/              # Модальные окна
│   │   ├── providers/           # WebSocket-провайдер, модальные окна
│   │   ├── queries/             # TanStack Query-хуки
│   │   ├── router/              # Роутинг (vk-mini-apps-router)
│   │   ├── store/               # Zustand сторы
│   │   └── views/               # Экраны (Views)
│   └── vite.config.ts           # Vite + VK WebView-compatible build configuration
│
├── backend/                     # Backend: Hono + Prisma ORM + PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma        # Модели: User, RefreshToken, Notification, Car, Trip, Booking, Review
│   │   ├── migrations/          # Prisma-миграции (единый snapshot)
│   │   └── seed.ts              # Наполнение тестовыми данными (22 юзера, 28 поездок и т.д.)
│   ├── src/
│   │   ├── auth/                # VK-авторизация (подпись launch params + диагностика дрейфа часов), JWT + refresh-токены (ротация, хэш в БД)
│   │   ├── middleware/          # Rate limiting, sanitize (DOMPurify), requireUser
│   │   ├── trips/               # Поездки (+ пагинация, статусы, авто-завершение)
│   │   ├── bookings/            # Бронирования (Serializable, P2002/P2034 → 409)
│   │   ├── reviews/             # Отзывы (Serializable, P2034 → retry → 503)
│   │   ├── notifications/       # Уведомления (курсорная пагинация, unreadCount)
│   │   ├── users/               # Профили, авто, настройки уведомлений
│   │   ├── ws/                  # WebSocket (auth, рассылка событий)
│   │   ├── workers/             # Фон: авто-завершение просроченных поездок
│   │   ├── serializers/         # Сериализация ответов
│   │   ├── services/            # Бизнес-сервисы (уведомления, wsManager с reaper-очисткой)
│   │   ├── utils/               # Sentry-хелперы (initSentry с PII-стриппингом, captureWarning/Exception)
│   │   ├── app.ts               # Hono-приложение (роуты /api/v1, security-заголовки)
│   │   └── index.ts             # Серверный entry point (initSentry, graceful shutdown)
│   ├── .env                     # Переменные окружения (dev)
│   └── .env.test                # Переменные окружения для тестов (отдельная БД edem_test)
│
├── packages/
│   └── contracts/               # Общий пакет Zod-схем, DTO и WS-контрактов
│       ├── src/
│       │   ├── schemas/         # Zod-схемы сущностей (trip, user, booking, review, ws)
│       │   └── dto/             # Схемы входных/выходных DTO (вкл. paginatedTripsResponseSchema)
│       └── tests/               # Юнит-тесты контрактов (Vitest)
│
└── package.json                 # Корневой package.json (npm workspaces)
```

## 🚀 Команды разработки

### Запуск проекта (Фронтенд + Бэкенд)
```bash
npm ci
cp backend/.env.example backend/.env
docker compose -f docker-compose.local.yml up -d
npm run dev
```
Команда параллельно запустит бэкенд на порту 3011 и frontend из workspace `mini-app` на порту 3010. Единственная Vite-конфигурация — `mini-app/vite.config.ts`; она проксирует `/api`, включая WebSocket `/api/v1/ws`, на бэкенд. Порты можно изменить через `BACKEND_PORT`, `VITE_PORT` и `VITE_API_TARGET`.

Backend читает `backend/.env`; Vite читает `mini-app/.env` и переменные текущего shell. Корневой `.env` предназначен для Docker Compose.

Канонический workflow использует npm workspaces. Bun остаётся опциональным для точечного запуска workspace-команд, но для воспроизводимой установки и CI используйте `npm ci`/`npm run`.

### Запуск в Docker (бэкенд в контейнере)
```bash
docker compose up -d --build   # сборка и запуск db + backend (:3000)
docker compose -f docker-compose.local.yml up -d # локальный PostgreSQL (:5433)
docker compose stop backend    # остановить контейнер бэкенда (оставить БД)
```
Требуется корневой `.env` с переменными `POSTGRES_PASSWORD`, `JWT_SECRET`, `VK_APP_SECRET`, `CORS_ORIGINS` (образец — `.env.example`). Миграции применяются автоматически при старте контейнера. Reseed внутри контейнера:
```bash
docker exec -it vk-mini-edem-backend-1 node --import tsx prisma/seed.ts
```

### Установка зависимостей
```bash
npm ci
```

### Сборка приложения (включая общий пакет)
```bash
npm run build          # contracts → backend → mini-app (Vite build)
npm run build:contracts  # только contracts
```

### База данных (Prisma)
```bash
npm run db:generate       # Сгенерировать Prisma Client
npm run db:migrate        # Создать миграцию (dev, интерактивно)
npm run db:migrate:deploy # Применить миграции к БД
npm run db:seed           # Заполнить БД тестовыми данными (идемпотентно)
npm run prisma:validate   # Валидация schema.prisma
```

Быстрый старт на свежей БД:
```bash
cd backend
npx prisma migrate deploy   # применить миграции (или npx prisma migrate reset --force)
npm run db:seed --workspace=backend
```

### Проверки и тесты
```bash
npm run typecheck        # tsc --noEmit во всех воркспейсах
npm run test             # Юнит-тесты (Vitest): contracts + backend
npm run lint             # typecheck всех воркспейсов + ESLint frontend
npm run format:check     # базовая проверка текстовых файлов и JSON без перезаписи
npm run build            # contracts → backend → mini-app
```

Тесты backend запускаются на отдельной БД `edem_test` (см. `backend/.env.test`), поэтому рабочая БД не затрагивается. При локальном Compose создайте её через `docker exec vk-mini-edem-db-dev psql -U edem -c "CREATE DATABASE edem_test;"`, затем выполните `npm run db:test:push --workspace=backend`. GitHub Actions поднимает PostgreSQL 16 с готовой `edem_test` автоматически и выполняет те же lint, format, build и test-проверки на Node 22.

## ⚙️ Настройка окружения

Для локального запуска бэкенда необходим файл `backend/.env`. Пример:

```env
DATABASE_URL="postgresql://user:password@host:port/db?schema=public"
NODE_ENV=development
ALLOW_DEV_AUTH=true            # Dev-имитация VK-подписи (только не в production); mock refresh-токены работают end-to-end
JWT_SECRET=your-jwt-secret-key-32-chars-long
VK_APP_SECRET=your-vk-app-secret
SENTRY_DSN=                    # Sentry DSN (пусто — Sentry выключен)
CORS_ORIGINS=http://localhost:3010
BACKEND_PORT=3011
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
VK_AUTH_RATE_WINDOW_MS=300000
VK_AUTH_RATE_MAX=5
REFRESH_RATE_WINDOW_MS=600000
REFRESH_RATE_MAX=10
LOG_LEVEL=debug
```

Все числовые настройки должны быть положительными целыми числами. Ноль,
отрицательные, дробные и частично числовые значения останавливают запуск с
ошибкой конфигурации; отсутствующие переменные используют значения по умолчанию
из `backend/src/env.ts`. Полный контракт описан в `backend/ENVIRONMENT.md`.

Для тестов — `backend/.env.test` с `DATABASE_URL`, указывающим на `edem_test`. Файл отслеживается в git и содержит только локальные тестовые значения; реальные секреты в него добавлять нельзя. Корневой `.env.example` предназначен для Docker Compose, а `backend/.env.example` — для локального backend.

## 🔌 API

Все REST-роуты находятся под префиксом **`/api/v1`**:

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/v1/auth/vk` | Вход через VK (дефолт 5 req/5 мин, `VK_AUTH_RATE_*`) |
| POST | `/api/v1/auth/refresh` | Ротация refresh-токена; reuse → отзыв всех токенов (дефолт 10 req/10 мин, `REFRESH_RATE_*`) |
| POST | `/api/v1/auth/logout` | Отзыв refresh-токена |
| GET | `/api/v1/trips` | Список активных поездок (пагинация `{items, pagination}`) |
| GET | `/api/v1/trips/my?status=active\|archive` | Поездки текущего водителя (фильтр по статусу) |
| GET | `/api/v1/trips/:id` | Детали поездки (занятые места, моя бронь) |
| POST | `/api/v1/trips` | Создание поездки (нужна машина, макс. `MAX_SEATS = 4` мест) |
| PATCH | `/api/v1/trips/:id` | Редактирование поездки (нельзя уменьшить места ниже занятых) |
| PATCH | `/api/v1/trips/:id/cancel` | Отмена поездки |
| PATCH | `/api/v1/trips/:id/complete` | Завершение поездки (`?force=1` — только dev/test) |
| POST | `/api/v1/bookings` | Создание брони (гонка → 409 SEAT_TAKEN; уехавшая поездка → 400 TRIP_IN_PAST) |
| PATCH | `/api/v1/bookings/:id/status` | Подтвердить/отклонить pending-заявку до отправления |
| PATCH | `/api/v1/bookings/:id/cancel` | Отмена брони пассажиром |
| GET | `/api/v1/bookings/my` | Мои брони (пассажир) |
| GET | `/api/v1/bookings/history` | История броней |
| GET | `/api/v1/bookings/trip/:tripId` | Заявки по поездке (водитель) |
| GET | `/api/v1/notifications/my?cursor=&limit=` | Уведомления (курсорная пагинация, `unreadCount`) |
| PATCH | `/api/v1/notifications/:id/read` | Отметить прочитанным |
| PATCH | `/api/v1/notifications/read-all` | Отметить все прочитанными |
| GET | `/api/v1/reviews` | Отзывы |
| POST | `/api/v1/reviews` | Отзыв после поездки: пассажир → водитель или водитель → подтверждённый пассажир |
| GET | `/api/v1/reviews/my` | Отзывы, оставленные текущим пользователем |
| GET | `/api/v1/reviews/available-trips` | Поездки для отзыва (пассажир или водитель с подтверждёнными пассажирами) |
| GET | `/api/v1/reviews/user/:userId` | Публичный список отзывов о пользователе |
| GET | `/api/v1/users/me` | Текущий пользователь |
| PATCH | `/api/v1/users/me` | Обновление профиля |
| PATCH | `/api/v1/users/me/car` | Управление авто |
| PATCH | `/api/v1/users/me/notification-settings` | Настройки уведомлений |
| GET | `/api/v1/users/:id` | Публичный профиль |
| WS | `/api/v1/ws` | WebSocket-события; access token отправляется первым auth-сообщением |
| GET | `/health`, `/health/live`, `/health/ready` | Проверки здоровья |

## 🔒 Безопасность

- **Sanitization**: все мутации проходят через `getSanitizedBody` (isomorphic-dompurify, без HTML-тегов) — защита от XSS.
- **Refresh-токены**: хранятся в БД хэшированными (SHA-256), одноразовые — при каждом `/refresh` старый отзывается, выдаётся новый (`rotateRefreshToken`, атомарный UPDATE с предикатом `revokedAt IS NULL` — из параллельных ротаций одного токена succeeds ровно одна). **Reuse detection**: предъявление уже ротированного токена отзывает ВСЕ активные токены пользователя (token family revocation); повторный `/logout` тем же токеном семью не отзывает.
- **Rate limiting**: раздельные лимитеры для `/auth/vk`, `/auth/refresh`, чтения и мутаций.
- **Гонка броней**: partial unique index `active_seat_booking` + Serializable-изоляция → второй запрос получает 409, а не некорректные данные.
- **Статусы брони**: только `pending → confirmed|declined`; отменённые, отклонённые и подтверждённые брони нельзя воскресить через водительский endpoint.
- **Отзывы**: Serializable-транзакция с одним ретраем при P2034; разрешены только направления пассажир → водитель и водитель → подтверждённый пассажир.
- **Валидация**: Zod-схемы проверяют входы backend, критичные paginated-ответы fail closed при contract drift, а frontend валидирует API и WebSocket payloads.
- **Приватность**: публичные профили не содержат госномер, публичные поездки не раскрывают точные адреса встречи.
- **Заголовки**: `X-Content-Type-Options`, CSP `frame-ancestors` (разрешены vk.com/vk.ru и m.vk.com/m.vk.ru — мини-апп грузится в iframe), `Referrer-Policy`, `Permissions-Policy`, HSTS (в production).
- **Ограничение тела запроса**: 100 KB.
- **Время**: даты сериализуются в `Europe/Moscow` (в контейнере задано через `TZ`).
- **Критичные уведомления** (смена статуса брони/поездки) создаются всегда, независимо от настройки `notificationsEnabled` пользователя.
- **Sentry (опционально, `SENTRY_DSN`)**: перед отправкой события очищаются от PII — `user` обнуляется, в `request` остаются только url/method, из `extra` вырезаются чувствительные ключи (token/password/secret/cookie и т.д.); без DSN хелперы деградируют в обычные логи.

## 📡 WebSocket

После авторизации клиент подключается к `/api/v1/ws` и отправляет `{ type: "auth", token }`. Токен не находится в URL. Сервер рассылает события:
`booking:new`, `booking:status_changed`, `trip:status_changed`, `notification:new`, `pong`/`ping`. Клиент автоматически реконнектится с exponential backoff и jitter, инвалидирует затронутые TanStack Query-запросы и показывает snackbar-уведомления.

Reaper (`startWsReaper`/`stopWsReaper`): каждые 30 с сервер закрывает соединения без pong дольше 60 с; остановка идемпотентна, «зомби»-тики после остановки не чистят соединения (graceful shutdown).

## 🌐 PWA

PWA-плагин и Service Worker отключены в `mini-app/vite.config.ts` для деплоя в VK Mini App. Это предотвращает загрузку устаревшей версии приложения после обновления сборки. Авторизованные данные намеренно не кэшируются.

## 🛠 Технологии

- **Frontend**: React 19, VKUI v8, Zustand, TanStack Query, vk-mini-apps-router, Vite, Sentry
- **Backend**: Hono, Node.js (Bun опционально), Prisma ORM, PostgreSQL, jose (JWT), Zod, pino, @sentry/node, isomorphic-dompurify
- **Монорепозиторий**: npm workspaces, TypeScript, Vitest
- **CI**: GitHub Actions (checkout/setup-node v5, Node 22, PostgreSQL 16 как сервис)

## 🚀 Деплой (Production)

Архитектура: **всё на одном сервере** — бэкенд отдаёт API + статику (mini-app/dist) + WebSocket. Внешний HTTPS-терминатор (Traefik/nginx) должен проксировать на `<VM-IP>:3000`: production Compose публикует backend на всех интерфейсах VM, а PostgreSQL наружу не публикует. Ограничьте TCP-порт `3000` firewall-правилами так, чтобы к нему обращался только Traefik/nginx.

```
Пользователь → VK (WebView/iframe) → https://<your-domain> → Traefik (443) → 127.0.0.1:3000 (backend)
```

### Известные ограничения перед production

- `GET /api/v1/bookings/trip/:tripId` и frontend используют cursor pagination; водительский экран подгружает следующие страницы по мере необходимости.
- Детали поездки и заявки водителя имеют отдельные loading/error/retry состояния; при отсутствии сети приложение явно предупреждает, что сохранённые данные могут быть устаревшими.
- Даты поездок и date-only фильтры нормализуются через фиксированный `Europe/Moscow`; формы сохраняют только несекретные черновики и очищают их после успешной отправки.
- Rate limiting и WebSocket fan-out хранят состояние в памяти процесса и не подходят для нескольких backend-инстансов без Redis/pub-sub или ограничения deployment до одного инстанса.
- Haptic feedback VK Bridge вызывается только после успешных действий и безопасно отключается на неподдерживаемых клиентах.

### Аудит состояния

Аудит исходников выполнен 18 августа 2026. Подтверждённые проблемы перечислены выше; они не означают, что текущая сборка или тесты падают.

Проверено:

```bash
npm run typecheck   # все workspace: успешно
npm run test        # все workspace: успешно
npm run build       # contracts + backend + production frontend: успешно
```

Paginated endpoints проверяют ответы shared Zod-схемами и возвращают controlled `500` при contract drift; интеграционные fixture используют общий лимит мест.

### Требования VK Mini Apps

- **HTTPS обязателен** в production (кроме localhost).
- Сервер должен **разрешать iframe** — бэкенд отдаёт CSP `frame-ancestors 'self' https://vk.com https://m.vk.com https://vk.ru https://m.vk.ru` (не `X-Frame-Options: DENY`).
- `VKWebAppInit` вызывается в `main.tsx`; подпись launch params проверяется на бэкенде (`verifyVkLaunchSignature`, HMAC-SHA256 + `vk_ts` ≤ 5 мин; дрейф часов > 1 мин логируется и отправляется в Sentry для диагностики). Принимается только полный `searchParams` из launch-параметров — реконструкция подписи по отдельным полям не поддерживается.
- Клиентские `firstName`, `lastName` и `photo` не используются как доказательство личности; статус `isVerified` не выводится из неподписанных полей.
- Swipe-back синхронизируется через `VKWebAppSetSwipeSettings`, а сообщения навигации принимаются только от родительского VK-контейнера из разрешённых origin.
- Опциональная отправка сообщений через `messages.send` использует `VK_GROUP_ID` и `VK_GROUP_TOKEN`; токен отправляется в POST body.

### Шаги деплоя

1. **Собрать**:
   ```bash
   npm ci
   npm run build        # contracts → backend (dist) → mini-app (dist, base: './')
   ```
2. **Применить миграции**:
   ```bash
   npm run db:migrate:deploy
   ```
3. **Запустить** (production):
   ```bash
   NODE_ENV=production PORT=3000 npm start
   ```
   Или через Docker: `docker compose up -d --build` (backend на :3000, миграции применяются при старте).

### Переменные окружения (production)

| Переменная | Обязательна | Описание |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL (в Docker — `postgresql://edem:...@db:5432/edem`) |
| `JWT_SECRET` | ✅ | ≥ 32 символов (проверяется в production) |
| `VK_APP_SECRET` | ✅ | Защищённый ключ приложения из консоли VK (dev.vk.com → Настройки) |
| `CORS_ORIGINS` | ✅ | Разрешённые origin (для iframe VK: `https://vk.com,https://m.vk.com,https://vk.ru,https://m.vk.ru`) |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | — | По умолчанию 3000 |
| `SENTRY_DSN` | — | Мониторинг ошибок |
| `ALLOW_DEV_AUTH` | — | В production принудительно `false` |

### Консоль VK (dev.vk.com)

1. Создать мини-апп → получить числовой **app_id**.
2. В настройках указать **URL мини-аппа** (например, `https://<your-domain>`) для платформ mobile/web/mvk.
3. Скопировать **защищённый ключ** → в `VK_APP_SECRET`.
4. Тестировать: `https://vk.com/app<app_id>`.
5. Для публикации в каталоге — отправить на модерацию (каждое обновление — повторная модерация).

### WebSocket за Traefik/nginx

Прокси должен поддерживать upgrade (Traefik — из коробки). Клиент подключается к `wss://<host>/api/v1/ws`.
