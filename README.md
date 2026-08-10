# Edem — Сервис попутных поездок (VK Mini App)

Монорепозиторий проекта **Edem** (аналог BlaBlaCar для VK Mini Apps). Приложение позволяет водителям предлагать поездки, а пассажирам — бронировать места, оставлять отзывы и просматривать историю своих поездок.

## 🌟 Основные возможности

- **Поиск поездок**: поиск с фильтрацией по городам, дате, цене и тегам, offset-пагинация (`page`/`limit`); собственные поездки исключаются из выдачи (при пустой странице клиент догружает следующие).
- **Создание поездок**: для водителей с указанием цены, количества мест, тегов и комментария.
- **Бронирование мест**: пассажиры бронируют места в активных поездках; защита от гонки броней на уровне БД (partial unique index + Serializable-транзакции).
- **Заявки пассажиров**: водитель подтверждает или отклоняет заявки, место удерживается в статусе `pending`.
- **Отзывы и рейтинги**: система рейтингов водителей и пассажиров, отзывы после завершённых поездок в обе стороны (пассажир → водитель и водитель → пассажир).
- **Уведомления**: встроенные уведомления + WebSocket-пуши (новая заявка, статус брони, отмена поездки).
- **Управление автомобилями**: добавление и редактирование информации об авто для водителей.
- **Интеграция с VK**: авторизация через VK ID (имитация в Dev-режиме), компоненты VKUI, PWA.

## 📁 Структура монорепозитория

```edem/
├── mini-app/                    # Frontend: React + VKUI + Vite (PWA)
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
│   └── vite.config.ts           # Vite + vite-plugin-pwa (Workbox)
│
├── backend/                     # Backend: Hono + Prisma ORM + PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma        # Модели: User, RefreshToken, Notification, Car, Trip, Booking, Review
│   │   ├── migrations/          # Prisma-миграции (единый snapshot)
│   │   └── seed.ts              # Наполнение тестовыми данными (22 юзера, 28 поездок и т.д.)
│   ├── src/
│   │   ├── auth/                # VK-авторизация, JWT + refresh-токены (ротация, хэш в БД)
│   │   ├── middleware/          # Rate limiting, sanitize (DOMPurify), requireUser
│   │   ├── trips/               # Поездки (+ пагинация, статусы, авто-завершение)
│   │   ├── bookings/            # Бронирования (Serializable, P2002/P2034 → 409)
│   │   ├── reviews/             # Отзывы (Serializable, P2034 → retry → 503)
│   │   ├── notifications/       # Уведомления (курсорная пагинация, unreadCount)
│   │   ├── users/               # Профили, авто, настройки уведомлений
│   │   ├── ws/                  # WebSocket (auth, рассылка событий)
│   │   ├── workers/             # Фон: авто-завершение просроченных поездок
│   │   ├── serializers/         # Сериализация ответов
│   │   ├── services/            # Бизнес-сервисы (уведомления)
│   │   ├── app.ts               # Hono-приложение (роуты /api/v1, security-заголовки)
│   │   └── index.ts             # Серверный entry point
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
npm run dev          # или: bun run dev
```
Команда параллельно запустит бэкенд на порту 3001 и фронтенд (Vite) на порту 3000. Vite проксирует `/api/v1` и `/ws` на бэкенд.

> **Примечание**: `dev:backend` использует `bun run --cwd backend dev` (bun-совместимый синтаксис). Если bun не установлен — поставьте его (`curl -fsSL https://bun.sh/install | bash`) или замените скрипт на `npm run dev --workspace=backend`.

### Запуск в Docker (бэкенд в контейнере)
```bash
docker compose up -d --build   # сборка и запуск db + backend (:3000)
docker compose up -d db        # только PostgreSQL (для локального dev)
docker compose stop backend    # остановить контейнер бэкенда (оставить БД)
```
Требуется корневой `.env` с переменными `POSTGRES_PASSWORD`, `JWT_SECRET`, `VK_APP_SECRET`, `CORS_ORIGINS` (образец — `.env.example`). Миграции применяются автоматически при старте контейнера. Reseed внутри контейнера:
```bash
docker exec -it vk-mini-edem-backend-1 node --import tsx prisma/seed.ts
```

### Установка зависимостей
```bash
npm install
```

### Сборка приложения (включая общий пакет)
```bash
npm run build          # contracts → backend → mini-app (vite build + PWA)
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
bash run_workflow.sh     # Полный CI-прогон: build contracts → prisma generate/validate → typecheck ×3 → build → тесты
```

Тесты backend запускаются на отдельной БД `edem_test` (см. `backend/.env.test`), поэтому рабочая БД не затрагивается. Перед первым запуском тестов: `docker exec vk-mini-edem-db-1 psql -U edem -c "CREATE DATABASE edem_test;"` и `npm run db:test:push --workspace=backend`.

## ⚙️ Настройка окружения

Для локального запуска бэкенда необходим файл `backend/.env`. Пример:

```env
DATABASE_URL="postgresql://user:password@host:port/db?schema=public"
NODE_ENV=development
ALLOW_DEV_AUTH=true            # Dev-имитация VK-подписи (только не в production); mock refresh-токены работают end-to-end
JWT_SECRET=your-jwt-secret-key-32-chars-long
VK_APP_SECRET=your-vk-app-secret
CORS_ORIGINS=http://localhost:3000
BACKEND_PORT=3001
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
AUTH_RATE_WINDOW_MS=900000
AUTH_RATE_MAX=20
LOG_LEVEL=debug
```

Для тестов — `backend/.env.test` (аналогично, но `DATABASE_URL` указывает на `edem_test`). Оба файла в `.gitignore`.

## 🔌 API

Все REST-роуты находятся под префиксом **`/api/v1`**:

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/v1/auth/vk` | Вход через VK (5 req/5 мин) |
| POST | `/api/v1/auth/refresh` | Ротация refresh-токена (10 req/10 мин) |
| POST | `/api/v1/auth/logout` | Отзыв refresh-токена |
| GET | `/api/v1/trips` | Список активных поездок (пагинация `{items, pagination}`) |
| GET | `/api/v1/trips/my?status=active\|archive` | Поездки текущего водителя (фильтр по статусу) |
| GET | `/api/v1/trips/:id` | Детали поездки (занятые места, моя бронь) |
| POST | `/api/v1/trips` | Создание поездки (нужна машина, макс. `MAX_SEATS = 4` мест) |
| PATCH | `/api/v1/trips/:id` | Редактирование поездки (нельзя уменьшить места ниже занятых) |
| PATCH | `/api/v1/trips/:id/cancel` | Отмена поездки |
| PATCH | `/api/v1/trips/:id/complete` | Завершение поездки (`?force=1` — только dev/test) |
| POST | `/api/v1/bookings` | Создание брони (гонка → 409 SEAT_TAKEN; уехавшая поездка → 400 TRIP_IN_PAST) |
| PATCH | `/api/v1/bookings/:id/status` | Подтвердить/отклонить заявку |
| PATCH | `/api/v1/bookings/:id/cancel` | Отмена брони пассажиром |
| GET | `/api/v1/bookings/my` | Мои брони (пассажир) |
| GET | `/api/v1/bookings/history` | История броней |
| GET | `/api/v1/bookings/trip/:tripId` | Заявки по поездке (водитель) |
| GET | `/api/v1/notifications/my?cursor=&limit=` | Уведомления (курсорная пагинация, `unreadCount`) |
| PATCH | `/api/v1/notifications/:id/read` | Отметить прочитанным |
| PATCH | `/api/v1/notifications/read-all` | Отметить все прочитанными |
| GET | `/api/v1/reviews` | Отзывы |
| POST | `/api/v1/reviews` | Создание отзыва (участник поездки, не себе, не повторно) |
| GET | `/api/v1/reviews/my` | Отзывы, оставленные текущим пользователем |
| GET | `/api/v1/reviews/available-trips` | Поездки для отзыва (пассажир или водитель с подтверждёнными пассажирами) |
| GET | `/api/v1/reviews/user/:userId` | Публичный список отзывов о пользователе |
| GET | `/api/v1/users/me` | Текущий пользователь |
| PATCH | `/api/v1/users/me` | Обновление профиля |
| PATCH | `/api/v1/users/me/car` | Управление авто |
| PATCH | `/api/v1/users/me/notification-settings` | Настройки уведомлений |
| GET | `/api/v1/users/:id` | Публичный профиль |
| WS | `/api/v1/ws?token=` | WebSocket-события (booking:new, status_changed, notification:new и др.) |
| GET | `/health`, `/health/live`, `/health/ready` | Проверки здоровья |

## 🔒 Безопасность

- **Sanitization**: все мутации проходят через `getSanitizedBody` (isomorphic-dompurify, без HTML-тегов) — защита от XSS.
- **Refresh-токены**: хранятся в БД хэшированными (SHA-256), одноразовые — при каждом `/refresh` старый отзывается, выдаётся новый (`rotateRefreshToken`, атомарная транзакция).
- **Rate limiting**: раздельные лимитеры для `/auth/vk`, `/auth/refresh`, чтения и мутаций.
- **Гонка броней**: partial unique index `active_seat_booking` + Serializable-изоляция → второй запрос получает 409, а не некорректные данные.
- **Отзывы**: Serializable-транзакция с одним ретраем при P2034; повторный конфликт → 503 (не маскируется под «отзыв уже оставлен» 409 — дубль ловится отдельно по уникальному индексу).
- **Валидация**: Zod-схемы на входе (backend) и на выходе (frontend, `apiClient.request<T>(url, opts, schema)`).
- **Заголовки**: `X-Content-Type-Options`, CSP `frame-ancestors` (разрешены vk.com/vk.ru и m.vk.com/m.vk.ru — мини-апп грузится в iframe), `Referrer-Policy`, `Permissions-Policy`, HSTS (в production).
- **Ограничение тела запроса**: 100 KB.
- **Время**: даты сериализуются в `Europe/Moscow` (в контейнере задано через `TZ`).
- **Критичные уведомления** (смена статуса брони/поездки) создаются всегда, независимо от настройки `notificationsEnabled` пользователя.

## 📡 WebSocket

После авторизации клиент подключается к `/api/v1/ws?token=...` и отправляет `{ type: "auth", token }`. Сервер рассылает события:
`booking:new`, `booking:status_changed`, `trip:status_changed`, `notification:new`, `pong`/`ping`. Клиент автоматически реконнектится (3с), инвалидирует затронутые TanStack Query-запросы и показывает snackbar-уведомления.

## 🌐 PWA

Frontend собран как PWA (`vite-plugin-pwa`, `autoUpdate`):
- манифест с иконками 192/512 (maskable);
- service worker с прекэшем статики и runtime-кэшированием:
  - `NetworkFirst` для публичного списка поездок (офлайн-доступ к результатам поиска, 1 час);
  - `CacheFirst` для аватаров (`i.pravatar.cc`, 30 дней);
- авторизованные API-эндпоинты намеренно не кэшируются (защита данных пользователей).

> **Примечание (деплой в VK Mini App):** PWA отключён в `mini-app/vite.config.ts` — Service Worker кэширует старую версию приложения и конфликтует с деплоем (URL меняется при каждом обновлении). В WebView VK офлайн-сценарий не критичен, а риски белого экрана — критичны.

## 🛠 Технологии

- **Frontend**: React 19, VKUI v8, Zustand, TanStack Query, vk-mini-apps-router, Vite, vite-plugin-pwa, Sentry
- **Backend**: Hono, Bun/Node.js, Prisma ORM, PostgreSQL, jose (JWT), Zod, pino, isomorphic-dompurify
- **Монорепозиторий**: npm workspaces, TypeScript, Vitest
- **CI**: GitHub Actions (checkout/setup-node v5, Node 22, PostgreSQL 16 как сервис)

## 🚀 Деплой (Production)

Архитектура: **всё на одном сервере** — бэкенд отдаёт API + статику (mini-app/dist) + WebSocket. Внешний HTTPS-терминатор (Traefik/nginx) проксирует на порт 3000.

```
Пользователь → VK (WebView/iframe) → https://<your-domain> → Traefik (443) → 0.0.0.0:3000 (backend)
```

### Требования VK Mini Apps

- **HTTPS обязателен** в production (кроме localhost).
- Сервер должен **разрешать iframe** — бэкенд отдаёт CSP `frame-ancestors 'self' https://vk.com https://m.vk.com https://vk.ru https://m.vk.ru` (не `X-Frame-Options: DENY`).
- `VKWebAppInit` вызывается в `main.tsx`; подпись launch params проверяется на бэкенде (`verifyVkLaunchSignature`, HMAC-SHA256 + `vk_ts` ≤ 5 мин). Принимается только полный `searchParams` из launch-параметров — реконструкция подписи по отдельным полям не поддерживается.

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
