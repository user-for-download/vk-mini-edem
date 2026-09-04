# Edem — Сервис попутных поездок (VK Mini App)

Монорепозиторий проекта **Edem** (аналог BlaBlaCar для VK Mini Apps). Приложение позволяет водителям предлагать поездки, а пассажирам — бронировать места, оставлять отзывы и просматривать историю своих поездок.

## 🌟 Основные возможности

- **Поиск поездок**: поиск с фильтрацией по городам, дате, цене и тегам, offset-пагинация (`page`/`limit`); собственные поездки исключаются из выдачи (при пустой странице клиент догружает следующие); уже отправившиеся поездки в выдачу не попадают.
- **Создание поездок**: для водителей с указанием цены, количества мест, тегов и комментария.
- **Бронирование мест**: пассажиры бронируют места в активных поездках; защита от гонки броней на уровне БД (partial unique index + Serializable-транзакции).
- **Заявки пассажиров**: водитель подтверждает или отклоняет заявки, место удерживается в статусе `pending`.
- **Связь через ЛС ВКонтакте**: после создания брони и после подтверждения у пассажира и водителя появляется кнопка «Написать в VK», открывающая диалог ВКонтакте с контрагентом (`vk.com/im?sel={vkUserId}`). Свой чат не строится — используются сообщения VK. `vkUserId` отдаётся дозированно, только участникам активной брони.
- **Отзывы и рейтинги**: система рейтингов водителей и пассажиров, отзывы после начала или завершения поездки в обе стороны (пассажир → водитель и водитель → пассажир). Отзывы проходят модерацию: создаются в статусе `pending` и публикуются после одобрения администратором — публичные списки и рейтинг учитывают только опубликованные; автор получает уведомление об одобрении/отклонении и видит статус в «Мои отзывы» профиля. Текст отзыва — до 150 символов.
- **Уведомления**: встроенные уведомления + WebSocket-пуши (новая заявка, статус брони, отмена поездки) и **реальные push ВКонтакте** через `notifications.sendMessage` на ключевые события (подтверждение/отклонение брони, отмена поездки, завершение) — приходят даже при закрытом приложении, тап открывает нужный экран (deep-link по `fragment`). Сервисный ключ `VK_SERVICE_KEY` опционален; без него push не отправляются, остальная доставка работает.
- **Управление автомобилями**: добавление и редактирование информации об авто для водителей.
- **Админ-панель** (`webapp/`): отдельное веб-приложение на React 19 + shadcn/ui — дашборд с метриками, пользователи (бан/разбан, сброс онбординга), поездки (отмена), брони (смена статуса), отзывы (модерация: одобрение/отклонение/удаление, фильтр по статусу), обратная связь (просмотр + ответ пользователю), read-only настройки. Вход по статичному `ADMIN_TOKEN`, сессия — httpOnly cookie с JWT (12 ч).
- **Интеграция с VK**: авторизация через подписанные launch params VK, имитация только в Dev/Test, VKUI, WebSocket и опциональные сообщения от имени сообщества.
- **Онбординг**: при первом входе — нативные информационные экраны VK (`VKWebAppShowSlidesSheet`, 3 слайда). Показывается один раз: любой исход (просмотр, пропуск, закрытие) помечает обучение пройденным — флаг хранится на бэкенде (`User.onboardingVersion`, завершение через `POST /api/v1/users/me/onboarding`). Версионирование: повышение `ONBOARDING_VERSION` в мини-аппе заново показывает слайды всем пользователям по одному разу; админка может сбросить флаг (`PATCH /api/v1/admin/users/:id/onboarding-reset`). Изображения слайдов — временные заглушки (`mini-app/src/assets/onboarding/`, 832×555, base64 через Vite `?inline`, ленивый чанк).

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
│   │   ├── auth/                # VK-авторизация (подпись launch params + диагностика дрейфа часов), JWT + refresh-токены (ротация, хэш в БД), admin JWT
│   │   ├── admin/               # Админ-API /api/v1/admin (login/session/logout, guard по httpOnly cookie, модерация)
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
│   │   ├── utils/               # Sentry-хелперы (initSentry с PII-стриппингом, captureWarning/Exception), timingSafeEqual
│   │   ├── app.ts               # Hono-приложение (роуты /api/v1, security-заголовки)
│   │   └── index.ts             # Серверный entry point (initSentry, graceful shutdown)
│   ├── .env                     # Переменные окружения (dev)
│   └── .env.test                # Переменные окружения для тестов (отдельная БД edem_test)
│
├── webapp/                      # Админ-панель: React 19 + Vite 8 + Tailwind 4 + shadcn/ui + TanStack Router/Query
│   └── src/
│       ├── features/            # Секции: auth (страница входа), dashboard, users, trips, bookings, reviews, settings
│       ├── layouts/             # AdminLayout (сайдбар, кнопка «Выйти»)
│       ├── lib/                 # api-client (same-origin /api, 401 → редирект на /login)
│       └── routes.tsx           # TanStack Router: публичный /login + защищённые админ-роуты (проверка сессии)
│
├── e2e/                         # Full-cycle E2E-тесты (Playwright + Chromium), см. e2e/README.md
│
├── packages/
│   └── contracts/               # Общий пакет Zod-схем, DTO и WS-контрактов
│       ├── src/
│       │   ├── schemas/         # Zod-схемы сущностей (trip, user, booking, review, ws, admin)
│       │   └── dto/             # Схемы входных/выходных DTO (вкл. paginatedTripsResponseSchema, admin DTO)
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

### Запуск админ-панели
```bash
npm run dev --workspace=webapp   # админ-панель на http://localhost:3013
```
Dev-сервер webapp проксирует `/api` на бэкенд (`:3011`), поэтому admin-cookie работают same-origin без настройки CORS. Вход — по `ADMIN_TOKEN` из `backend/.env` (пустой токен = панель выключена). В production проксируйте на одном домене и статику webapp, и `/api` на бэкенд (см. раздел деплоя).

Канонический workflow использует npm workspaces (`npm ci`/`npm run`); lockfile — `package-lock.json`. Bun не поддерживается (bun.lock удалён, чтобы избежать дрейфа версий).

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
npm run build          # contracts → prisma generate → backend → mini-app (Vite build)
npm run build:contracts  # только contracts
```

### База данных (Prisma 7)
```bash
npm run db:generate       # Сгенерировать Prisma Client (в backend/src/generated, gitignored)
npm run db:migrate        # Создать миграцию (dev) + пересоздать клиент
npm run db:migrate:deploy # Применить миграции к БД
npm run db:seed           # Заполнить БД тестовыми данными (идемпотентно)
npm run prisma:validate   # Валидация schema.prisma
```
Подключение — через pg driver-адаптер `@prisma/adapter-pg` (`backend/src/db.ts`): URL из `DATABASE_URL`, параметры пула заданы в коде (node-pg игнорирует `connection_limit`/`pool_timeout` из URL — это параметры старого Rust-движка). Конфигурация CLI — `backend/prisma.config.ts`: в Prisma 7 `datasource.url` из схемы и автозагрузка `.env` удалены, URL берётся из окружения, `.env` подгружается явно. Сгенерированный клиент (`backend/src/generated/`) компилируется tsc в `dist`; после `git pull` с изменённой схемой выполните `npm run db:generate`.

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
ADMIN_TOKEN=                     # статичный токен админ-панели (пусто — панель выключена)
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
| GET | `/api/v1/trips` | Список активных поездок (пагинация `{items, pagination}`); уехавшие поездки скрыты |
| GET | `/api/v1/trips/my?status=active\|archive` | Поездки текущего водителя (фильтр по статусу) |
| GET | `/api/v1/trips/:id` | Детали поездки (занятые места, моя бронь) |
| POST | `/api/v1/trips` | Создание поездки (нужна машина, макс. `MAX_SEATS = 3` места) |
| PATCH | `/api/v1/trips/:id` | Редактирование поездки (нельзя уменьшить места ниже занятых; **маршрут** `fromCity/toCity` изменить нельзя — 400; уехавшую поездку редактировать нельзя — 409; смена времени проверяет брони пассажиров на пересечение) |
| PATCH | `/api/v1/trips/:id/cancel` | Отмена поездки |
| PATCH | `/api/v1/trips/:id/complete` | Завершение поездки (`?force=1` — только dev/test) |
| GET | `/api/v1/cities/suggest?q=&limit=` | Публичный справочник точек (автодополнение формы поездки; без auth, `q` опционален → весь список) |
| POST | `/api/v1/bookings` | Создание брони (гонка → 409 SEAT_TAKEN; уехавшая поездка → 400 TRIP_IN_PAST) |
| PATCH | `/api/v1/bookings/:id/status` | Подтвердить/отклонить pending-заявку до отправления |
| PATCH | `/api/v1/bookings/:id/cancel` | Отмена брони пассажиром |
| GET | `/api/v1/bookings/my` | Мои брони (пассажир) |
| GET | `/api/v1/bookings/history` | История броней |
| GET | `/api/v1/bookings/trip/:tripId` | Заявки по поездке (водитель) |
| GET | `/api/v1/notifications/my?cursor=&limit=` | Уведомления (курсорная пагинация, `unreadCount`) |
| PATCH | `/api/v1/notifications/:id/read` | Отметить прочитанным |
| PATCH | `/api/v1/notifications/read-all` | Отметить все прочитанными |
| POST | `/api/v1/reviews` | Отзыв после поездки (пассажир → водитель или водитель → подтверждённый пассажир); создаётся `pending` — публикуется после одобрения модерацией, текст ≤ 150 символов |
| GET | `/api/v1/reviews/my` | Отзывы, оставленные текущим пользователем (все статусы; элемент включает `status`) |
| GET | `/api/v1/reviews/available-trips` | Поездки для отзыва (пассажир или водитель с подтверждёнными пассажирами) |
| GET | `/api/v1/reviews/user/:userId` | Публичный список отзывов о пользователе (только опубликованные) |
| GET | `/api/v1/users/me` | Текущий пользователь |
| PATCH | `/api/v1/users/me` | Обновление профиля |
| PATCH | `/api/v1/users/me/car` | Управление авто |
| PATCH | `/api/v1/users/me/notification-settings` | Настройки уведомлений |
| POST | `/api/v1/users/me/onboarding` | Завершение онбординга: сохраняет версию показанных слайдов (`{version}` — строка 1..50 символов) |
| GET | `/api/v1/users/:id` | Публичный профиль |
| POST | `/api/v1/feedback` | Обращение в поддержку (тема ≤ 100, текст ≤ 2000; санитизация, rate limit) |
| GET | `/api/v1/feedback` | Мои обращения с ответами поддержки (`reply`/`repliedAt`; новые первыми) |
| POST | `/api/v1/admin/auth/login` | Вход админ-панели по `ADMIN_TOKEN` (5 req/5 мин, `ADMIN_LOGIN_RATE_*`); ставит httpOnly cookie `edem_admin_jwt` |
| GET | `/api/v1/admin/auth/session` | Состояние админ-сессии (всегда 200; httpOnly cookie недоступен JS) |
| POST | `/api/v1/admin/auth/logout` | Выход из админ-панели (очистка cookie) |
| GET | `/api/v1/admin/dashboard` | Метрики: пользователи, поездки, брони, отзывы, новые за 7 дней |
| GET | `/api/v1/admin/users` | Список пользователей (поиск `q`, пагинация) |
| PATCH | `/api/v1/admin/users/:id/ban` | Бан пользователя (`bannedAt` + обязательная причина `banReason` в теле `{ reason }`, 1–500 симв.); поездки не отменяются; открытые WS-соединения закрываются (4403) |
| PATCH | `/api/v1/admin/users/:id/unban` | Разбан |
| PATCH | `/api/v1/admin/users/:id/onboarding-reset` | Сброс флага онбординга (`onboardingVersion` → null): пользователь снова увидит слайды |
| GET | `/api/v1/admin/trips` | Список поездок (фильтр `status`, пагинация) |
| PATCH | `/api/v1/admin/trips/:id/cancel` | Отмена поездки (только статус, без каскада); завершённые/отменённые — 409 |
| GET | `/api/v1/admin/bookings` | Список броней (фильтр `status`, пагинация) |
| PATCH | `/api/v1/admin/bookings/:id/status` | Смена статуса брони (pending/confirmed/declined/cancelled) с пересчётом мест; конфликты — 409 |
| GET | `/api/v1/admin/reviews` | Список отзывов (фильтр `?status=pending\|published\|rejected`, пагинация; элемент включает `status`) |
| PATCH | `/api/v1/admin/reviews/:id/approve` | Одобрение отзыва (pending → published, пересчёт рейтинга получателя, уведомление автору; 404/409) |
| PATCH | `/api/v1/admin/reviews/:id/reject` | Отклонение отзыва (pending → rejected, уведомление автору; 404/409) |
| DELETE | `/api/v1/admin/reviews/:id` | Удаление отзыва (из любого статуса, с пересчётом рейтинга цели) |
| GET | `/api/v1/admin/feedback` | Список обращений в поддержку (пагинация; элемент включает `reply`/`repliedAt`) |
| GET | `/api/v1/admin/feedback/:id` | Детальная карточка обращения (404, если нет) |
| POST | `/api/v1/admin/feedback/:id/reply` | Первичный ответ поддержки (создаёт уведомление; 400, если ответ уже есть) |
| PUT | `/api/v1/admin/feedback/:id/reply` | Редактирование ответа (не двигает `repliedAt`; 400, если ответа ещё нет) |
| GET | `/api/v1/admin/cities` | Справочник точек (поиск `q`, пагинация) |
| POST | `/api/v1/admin/cities` | Создать точку (409 на дубликат имени) |
| PATCH | `/api/v1/admin/cities/:id` | Переименовать точку (409 на дубликат имени) |
| DELETE | `/api/v1/admin/cities/:id` | Удалить точку (409, если `tripsCount > 0`) |
| GET | `/api/v1/admin/settings` | Read-only снимок rate-limit'ов и флагов env |
| WS | `/api/v1/ws` | WebSocket-события; access token отправляется первым auth-сообщением |
| GET | `/health`, `/health/live`, `/health/ready` | Проверки здоровья |

Все endpoint'ы `/api/v1/admin/*`, кроме `/auth/*`, требуют валидную админ-сессию (httpOnly cookie); без неё — **401**. При пустом `ADMIN_TOKEN` панель выключена: **403** на всё, включая логин. Подробности — в [`docs/api/admin.md`](docs/api/admin.md).

## 🔒 Безопасность

- **Sanitization**: все мутации проходят через `getSanitizedBody` (isomorphic-dompurify, без HTML-тегов) — защита от XSS.
- **Refresh-токены**: хранятся в БД хэшированными (SHA-256), одноразовые — при каждом `/refresh` старый отзывается, выдаётся новый (`rotateRefreshToken`, атомарный UPDATE с предикатом `revokedAt IS NULL` — из параллельных ротаций одного токена succeeds ровно одна). **Reuse detection**: предъявление уже ротированного токена отзывает ВСЕ активные токены пользователя (token family revocation); повторный `/logout` тем же токеном семью не отзывает.
- **Rate limiting**: раздельные лимитеры для `/auth/vk`, `/auth/refresh` (`VK_AUTH_RATE_*`, `REFRESH_RATE_*`), логина админ-панели (`ADMIN_LOGIN_RATE_*`, анти-брутфорс), публичного чтения и мутаций (IP-based) и «дорогих» действий по аккаунту (user-based) — все настраиваются через ENV.
- **Админ-панель**: вход по статичному `ADMIN_TOKEN` (timing-safe сравнение); сессия — httpOnly cookie `edem_admin_jwt` с JWT (`type=admin-access`, `sub=admin`, TTL 12 ч): токен недоступен JS (защита от XSS), user-токены `type=access` админским guard'ом отклоняются. Панель закрыта по умолчанию: без `ADMIN_TOKEN` все запросы получают 403 в любой среде. Забаненные пользователи (`bannedAt`) получают 403 на всех аутентифицированных endpoint'ах; бан также применяется при логине в `/auth/vk` (403 `{ code: "FORBIDDEN", banReason }` — токены не выдаются, активные refresh-токены отзываются), в `/auth/refresh` (403 + отзыв активных refresh-токенов), в `optionalAuth` (забаненный считается гостем) и в WebSocket-аутентификации (соединение закрывается с 4403), а при бане через админку открытые WS-соединения пользователя закрываются сразу. Mini-app при 403 `FORBIDDEN` показывает экран «Аккаунт заблокирован» с причиной бана (или «Причина не указана» для старых банов) и кнопкой «Обратная связь»: обращение уходит через публичный `POST /api/v1/feedback/appeal` (личность — по подписи VK launch-параметров, без выдачи токенов, лимит 5/час на IP) и видно в админке.
- **Гонка броней**: partial unique index `active_seat_booking` + Serializable-изоляция → второй запрос получает 409, а не некорректные данные.
- **Статусы брони**: только `pending → confirmed|declined`; отменённые, отклонённые и подтверждённые брони нельзя воскресить через водительский endpoint.
- **Отзывы**: Serializable-транзакция с одним ретраем при P2034; разрешены только направления пассажир → водитель и водитель → подтверждённый пассажир. Модерация: отзыв создаётся `pending` и становится публичным только после одобрения администратором; публичные списки и рейтинг (`rating`/`reviewsCount`) учитывают только `published` (пересчёт — при одобрении и удалении, не при создании).
- **Валидация**: Zod-схемы проверяют входы backend, критичные paginated-ответы fail closed при contract drift, а frontend валидирует API и WebSocket payloads.
- **Приватность**: публичные профили не содержат госномер, публичные поездки не раскрывают точные адреса встречи. Числовой `vkUserId` (для кнопки «Написать в VK») отдаётся только участникам активной брони — `GET /trips/:id` (водителю и пассажиру с pending/confirmed), `GET /bookings/my`, `GET /bookings/trip/:tripId`; в публичных выдачах поле отсутствует.
- **Заголовки**: `X-Content-Type-Options`, CSP `frame-ancestors` (разрешены vk.com/vk.ru и m.vk.com/m.vk.ru — мини-апп грузится в iframe), `Referrer-Policy`, `Permissions-Policy`, HSTS (в production).
- **Ограничение тела запроса**: 100 KB.
- **Время**: даты сериализуются в `Europe/Moscow` (в контейнере задано через `TZ`).
- **Критичные уведомления** (смена статуса брони/поездки) создаются всегда, независимо от настройки `notificationsEnabled` пользователя.
- **Sentry (опционально, `SENTRY_DSN`)**: перед отправкой события очищаются от PII — `user` обнуляется, в `request` остаются только url/method, из `extra` вырезаются чувствительные ключи (token/password/secret/cookie и т.д.); без DSN хелперы деградируют в обычные логи.

## 📡 WebSocket

После авторизации клиент подключается к `/api/v1/ws` и отправляет `{ type: "auth", token }`. Токен не находится в URL. При аутентификации сервер проверяет пользователя в БД: забаненным соединения закрываются с кодом `4403`. Сервер рассылает события:
`booking:new`, `booking:status_changed`, `trip:status_changed`, `trip:details_changed`, `notification:new`, а также `ping` (keep-alive, клиент отвечает `pong`). Клиент автоматически реконнектится с exponential backoff и jitter, инвалидирует затронутые TanStack Query-запросы и показывает snackbar-уведомления.

Reaper (`startWsReaper`/`stopWsReaper`): каждые 30 с сервер закрывает соединения без pong дольше 60 с; остановка идемпотентна, «зомби»-тики после остановки не чистят соединения (graceful shutdown).

## 🌐 PWA

PWA-плагин и Service Worker отключены в `mini-app/vite.config.ts` для деплоя в VK Mini App. Это предотвращает загрузку устаревшей версии приложения после обновления сборки. Авторизованные данные намеренно не кэшируются.

## 🛠 Технологии

- **Frontend**: React 19, VKUI v8, Zustand, TanStack Query, vk-mini-apps-router, Vite 8, Sentry
- **Админ-панель**: React 19, Vite 8, Tailwind CSS 4, shadcn/ui, TanStack Router + Query, lucide-react, sonner
- **Backend**: Hono, Node.js 22, Prisma ORM, PostgreSQL, jose (JWT), Zod, pino, @sentry/node, isomorphic-dompurify
- **Монорепозиторий**: npm workspaces, TypeScript, Vitest
- **E2E**: Playwright + Chromium (`e2e/full-cycle.mjs`)
- **CI**: GitHub Actions (checkout/setup-node v5, Node 22, PostgreSQL 16 как сервис)

## 🚀 Деплой (Production)

Архитектура: **всё на одном сервере** — бэкенд отдаёт API + статику (mini-app/dist) + WebSocket. Внешний HTTPS-терминатор (Traefik/nginx) проксирует на backend:3000, а PostgreSQL наружу не публикуется.

Адрес публикации порта настраивается через `BACKEND_BIND_ADDR` в корневом `.env`:

- `127.0.0.1` (дефолт) — Traefik/nginx на том же хосте; прямой доступ извне исключён.
- `0.0.0.0` — Traefik/nginx на отдельном хосте; обязательно ограничьте TCP-порт `3000` firewall-правилами так, чтобы к нему обращался только Traefik/nginx.

```
Пользователь → VK (WebView/iframe) → https://<your-domain> → Traefik (443) → backend:3000
```

### Известные ограничения перед production

- `GET /api/v1/bookings/trip/:tripId` и frontend используют cursor pagination; водительский экран подгружает следующие страницы по мере необходимости.
- Детали поездки и заявки водителя имеют отдельные loading/error/retry состояния; при отсутствии сети приложение явно предупреждает, что сохранённые данные могут быть устаревшими.
- Даты поездок и date-only фильтры нормализуются через фиксированный `Europe/Moscow`; формы сохраняют только несекретные черновики и очищают их после успешной отправки.
- Rate limiting и WebSocket fan-out хранят состояние в памяти процесса и не подходят для нескольких backend-инстансов без Redis/pub-sub или ограничения deployment до одного инстанса.
- Haptic feedback VK Bridge вызывается только после успешных действий и безопасно отключается на неподдерживаемых клиентах.

### Аудит состояния

Полный аудит исходников выполнен 18 августа 2026, все найденные findings
(2 High, 7 Medium, 26 Low) устранены 21 августа 2026.

Проверено:

```bash
npm run typecheck    # все workspace: успешно
npm run test         # все workspace: успешно (164 теста)
npm run lint         # typecheck + ESLint frontend: успешно
npm run format:check # успешно
npm run bundle:check # gzip-бюджет: успешно
npm run build        # contracts + backend + production frontend: успешно
docker compose build # образ на node:22-alpine собирается
```

Paginated endpoints проверяют ответы shared Zod-схемами и возвращают controlled `500` при contract drift; интеграционные fixture используют общий лимит мест.

### Требования VK Mini Apps

- **HTTPS обязателен** в production (кроме localhost).
- Сервер должен **разрешать iframe** — бэкенд отдаёт CSP `frame-ancestors 'self' https://vk.com https://m.vk.com https://vk.ru https://m.vk.ru` (не `X-Frame-Options: DENY`).
- `VKWebAppInit` вызывается в `main.tsx`; подпись launch params проверяется на бэкенде (`verifyVkLaunchSignature`, HMAC-SHA256 + `vk_ts` ≤ 5 мин; дрейф часов > 1 мин логируется и отправляется в Sentry для диагностики). Принимается только полный `searchParams` из launch-параметров — реконструкция подписи по отдельным полям не поддерживается.
- Клиентские `firstName`, `lastName` и `photo` не используются как доказательство личности; статус `isVerified` не выводится из неподписанных полей. При этом они используются как отображаемые данные при входе: мини-апп достаёт профиль через VK Bridge `VKWebAppGetUserInfo` (таймаут 3 с) и отправляет поля вместе с `/auth/vk` (launch-параметры VK — fallback по каждому полю). Имя и фото сохраняются в профиль: аватар принимается только по https с VK CDN (`*.userapi.com`, `*.vk.com`, `*.vk.ru`, …) и синхронизируется при каждом входе, а имя заменяет только placeholder «Пользователь VK …» — вручную отредактированное имя не перезаписывается.
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
   Или через Docker: `docker compose up -d --build` (backend на :3000, админ-панель webapp на :3014, миграции применяются при старте).

### Переменные окружения (production)

| Переменная | Обязательна | Описание |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL (в Docker — `postgresql://edem:...@db:5432/edem`) |
| `JWT_SECRET` | ✅ | ≥ 32 символов (проверяется в production) |
| `VK_APP_SECRET` | ✅ | Защищённый ключ приложения из консоли VK (dev.vk.com → Настройки) |
| `VK_SERVICE_KEY` | — | Сервисный ключ мини-аппа для push-уведомлений (`notifications.sendMessage`). Пусто — push не отправляются, остальная доставка (WebSocket/БД) работает. Секрет. |
| `VK_GROUP_ID` / `VK_GROUP_TOKEN` | — | Сообщество для опциональных сообщений от него (`messages.send`). Пусто — сообщество-сообщения не отправляются |
| `CORS_ORIGINS` | ✅ | Разрешённые origin (для iframe VK: `https://vk.com,https://m.vk.com,https://vk.ru,https://m.vk.ru`) |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | — | По умолчанию 3000 |
| `SENTRY_DSN` | — | Мониторинг ошибок |
| `ALLOW_DEV_AUTH` | — | В production принудительно `false` |
| `ADMIN_TOKEN` | — | Статичный токен админ-панели; пусто — панель выключена. Задайте длинный случайный секрет |
| `ADMIN_JWT_TTL_SECONDS` | — | TTL админ-сессии (по умолчанию 43200 = 12 ч) |

### Консоль VK (dev.vk.com)

1. Создать мини-апп → получить числовой **app_id**.
2. В настройках указать **URL мини-аппа** (например, `https://<your-domain>`) для платформ mobile/web/mvk.
3. Скопировать **защищённый ключ** → в `VK_APP_SECRET`.
4. Тестировать: `https://vk.com/app<app_id>`.
5. Для публикации в каталоге — отправить на модерацию (каждое обновление — повторная модерация).

### WebSocket за Traefik/nginx

Прокси должен поддерживать upgrade (Traefik — из коробки). Клиент подключается к `wss://<host>/api/v1/ws`.

### Админ-панель (production)

Входит в `docker-compose.yml`: сервис `webapp` (nginx со статикой `webapp/dist`, порт публикации **3014**, адрес — `WEBAPP_BIND_ADDR` из root `.env`, дефолт `127.0.0.1`). Встроенный nginx-конфиг (`webapp/nginx.conf`) отдаёт SPA с fallback на `index.html` и проксирует `/api` на `backend:3000` внутри docker-сети — httpOnly cookie `edem_admin_jwt` работает same-origin (`SameSite=Lax`, без `SameSite=None`).

Деплой:

1. Задайте в root `.env`: `ADMIN_TOKEN` (длинный случайный секрет, например `openssl rand -hex 32`) и `WEBAPP_BIND_ADDR` (`0.0.0.0`, если прокси на отдельном хосте — и откройте порт 3014 в firewall).
2. `docker compose up -d --build` — образ webapp собирается сам (multi-stage: vite build → nginx).
3. Внешний reverse proxy: домен админки (например, `admin.<your-domain>`) → `:3014`, проксировать **весь** трафик, включая `/api`.

`Secure`-флаг cookie определяется по `X-Forwarded-Proto` (nginx пробраскивает его от вышестоящего прокси, иначе — по схеме соединения): по HTTPS cookie ставится с `Secure`, по HTTP — без него, логин работает в обоих случаях. В dev ту же роль выполняет Vite-прокси (`webapp/vite.config.ts`, порт 3013).
