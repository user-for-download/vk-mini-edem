# Edem — Сервис попутных поездок (VK Mini App)

Монорепозиторий проекта **Edem** (аналог BlaBlaCar для VK Mini Apps). Приложение позволяет водителям предлагать поездки, а пассажирам — бронировать места, оставлять отзывы и просматривать историю своих поездок.

## 🌟 Основные возможности

- **Поиск поездок**: поиск с фильтрацией по городам, дате, цене и тегам, offset-пагинация (`page`/`limit`).
- **Создание поездок**: для водителей с указанием цены, количества мест, тегов и комментария.
- **Бронирование мест**: пассажиры бронируют места в активных поездках; защита от гонки броней на уровне БД (partial unique index + Serializable-транзакции).
- **Заявки пассажиров**: водитель подтверждает или отклоняет заявки, место удерживается в статусе `pending`.
- **Отзывы и рейтинги**: система рейтингов водителей и пассажиров, отзывы после завершённых поездок.
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
│   │   ├── reviews/             # Отзывы
│   │   ├── notifications/       # Уведомления (курсорная пагинация, unreadCount)
│   │   ├── users/               # Профили, авто, настройки уведомлений
│   │   ├── ws/                  # WebSocket (auth, рассылка событий)
│   │   ├── workers/             # Фон: авто-завершение и очистка поездок
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
npm run dev
```
Команда параллельно запустит бэкенд на порту 3001 и фронтенд (Vite) на порту 3000. Vite проксирует `/api/v1` и `/ws` на бэкенд.

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
ALLOW_DEV_AUTH=true            # Dev-имитация VK-подписи (только не в production)
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

Все REST-роуты находятся под префиксом **`/api/v1`** (legacy-алиасы `/api/*` временно поддерживаются для совместимости):

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/v1/auth/vk` | Вход через VK (5 req/5 мин) |
| POST | `/api/v1/auth/refresh` | Ротация refresh-токена (10 req/10 мин) |
| POST | `/api/v1/auth/logout` | Отзыв refresh-токена |
| GET | `/api/v1/trips` | Список активных поездок (пагинация `{items, pagination}`) |
| GET | `/api/v1/trips/my` | Поездки текущего водителя |
| GET | `/api/v1/trips/:id` | Детали поездки (занятые места, моя бронь) |
| POST | `/api/v1/trips` | Создание поездки (нужна машина) |
| PATCH | `/api/v1/trips/:id` | Редактирование поездки |
| PATCH | `/api/v1/trips/:id/cancel` | Отмена поездки |
| PATCH | `/api/v1/trips/:id/complete` | Завершение поездки |
| POST | `/api/v1/bookings` | Создание брони (гонка → 409 SEAT_TAKEN) |
| PATCH | `/api/v1/bookings/:id/status` | Подтвердить/отклонить заявку |
| GET | `/api/v1/bookings/my` | Мои брони (пассажир) |
| GET | `/api/v1/bookings/history` | История броней |
| GET | `/api/v1/bookings/trip/:tripId` | Заявки по поездке (водитель) |
| GET | `/api/v1/notifications/my?cursor=&limit=` | Уведомления (курсорная пагинация, `unreadCount`) |
| PATCH | `/api/v1/notifications/:id/read` | Отметить прочитанным |
| PATCH | `/api/v1/notifications/read-all` | Отметить все прочитанными |
| GET/POST | `/api/v1/reviews` | Отзывы |
| GET | `/api/v1/users/me` | Текущий пользователь |
| PATCH | `/api/v1/users/me` | Обновление профиля |
| PATCH | `/api/v1/users/me/car` | Управление авто |
| PATCH | `/api/v1/users/me/notifications` | Настройки уведомлений |
| GET | `/api/v1/users/:id` | Публичный профиль |
| WS | `/api/v1/ws?token=` | WebSocket-события (booking:new, status_changed, notification:new и др.) |
| GET | `/health`, `/health/live`, `/health/ready` | Проверки здоровья |

## 🔒 Безопасность

- **Sanitization**: все мутации проходят через `getSanitizedBody` (isomorphic-dompurify, без HTML-тегов) — защита от XSS.
- **Refresh-токены**: хранятся в БД хэшированными (SHA-256), одноразовые — при каждом `/refresh` старый отзывается, выдаётся новый (`rotateRefreshToken`, атомарная транзакция).
- **Rate limiting**: раздельные лимитеры для `/auth/vk`, `/auth/refresh`, чтения и мутаций.
- **Гонка броней**: partial unique index `active_seat_booking` + Serializable-изоляция → второй запрос получает 409, а не некорректные данные.
- **Валидация**: Zod-схемы на входе (backend) и на выходе (frontend, `apiClient.request<T>(url, opts, schema)`).
- **Заголовки**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS (в production).
- **Ограничение тела запроса**: 100 KB.

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

## 🛠 Технологии

- **Frontend**: React 19, VKUI v8, Zustand, TanStack Query, vk-mini-apps-router, Vite, vite-plugin-pwa, Sentry
- **Backend**: Hono, Bun/Node.js, Prisma ORM, PostgreSQL, jose (JWT), Zod, pino, isomorphic-dompurify
- **Монорепозиторий**: npm workspaces, TypeScript, Vitest
