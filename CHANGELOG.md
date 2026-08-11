# Changelog

Все заметные изменения проекта документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### 🚀 Features

#### API Robustness (Phase 3)

- **`POST /bookings`** — корректная обработка P2002 (нарушение unique-constraint при гонке броней):
  - **200 OK** при идемпотентном retry (тот же пассажир + то же место) — возвращает существующую бронь (защита от «потерянных» броней при таймаутах клиента);
  - **409 SEAT_TAKEN** — место занял другой пассажир;
  - **409 ALREADY_BOOKED** — у пассажира уже есть активная бронь на эту поездку (другое место);
  - **409 BOOKING_CONFLICT** — неизвестный тип конфликта (логируется как ошибка).
  - Тип конфликта определяется по полям нарушенного индекса (`error.meta.target`; Prisma 5.22 для Postgres не отдаёт имя constraint).
- Добавлены именованные partial unique индексы (SQL-миграция, Prisma не умеет `where` в `@@unique`):
  - `active_seat_booking` — `(tripId, seat)` WHERE `status IN ('pending','confirmed')`;
  - `active_passenger_booking` — `(tripId, passengerId)` WHERE `status IN ('pending','confirmed')`.
  - Отменённые/отклонённые брони не занимают слот — место можно забронировать повторно.

#### Unified Refresh State (frontend)

- `ApiClient` — единый источник refresh-состояния:
  - `isRefreshing()` — синхронная проверка;
  - `onRefreshStart(listener)` / `onRefreshEnd(listener)` — события начала/завершения refresh (end вызывается один раз, только у инициатора);
  - класс теперь экспортируется (нужно для юнит-тестов).
- `WsProvider` использует `apiClient.isRefreshing()` вместо локального ref — устранены race conditions между HTTP-клиентом и WebSocket при refresh.
- Автоматический reconnect после успешного refresh через `onTokenUpdate`.
- Magic numbers вынесены в константы: `WS_RECONNECT_DELAY_MS = 3000`, `WS_REFRESH_WAIT_DELAY_MS = 1000`.

### 🧪 Testing

- `backend/tests/integration/booking-conflicts.test.ts` — идемпотентный retry (200), SEAT_TAKEN, ALREADY_BOOKED, повторное бронирование после отмены, гонка параллельных броней, проверка constraint-имени на уровне БД. Partial unique индексы создаются в `beforeAll` (`IF NOT EXISTS`) — тестовая БД живёт на `db push` и не получает их из миграций.
- `mini-app/src/api/__tests__/client.test.ts` — single-flight, `isRefreshing()`, события refreshStart/refreshEnd, `onTokenUpdate`, изоляция ошибок listener'ов.

### 🗄️ Database

- Миграция `20260811100000_booking_unique_indexes` — partial unique индексы бронирований (применяется `npm run db:migrate:deploy`).

### ⚠️ Breaking Changes

- **`POST /bookings`**: повторный запрос с теми же `(tripId, seat)` от того же пассажира теперь возвращает **200** с существующей бронью вместо 409 (было SEAT_TAKEN). Клиенты, полагавшиеся на 409 для собственных повторов, должны учитывать идемпотентный ответ.

#### Cursor-Based Pagination

- **`GET /reviews/user/:userId`** — теперь возвращает пагинированный ответ:

  ```json
  {
    "items": [Review[]],
    "pagination": { "nextCursor": "...", "hasMore": true, "limit": 20 }
  }
  ```

  Query params: `limit` (1-50, default 20), `cursor` (опциональный UUID последнего элемента предыдущей страницы).

- **`GET /bookings/trip/:tripId`** — аналогичная структура ответа.
  Query params: `limit` (1-50, default 50), `cursor`.

  **Migration guide:** клиенты должны переключиться с `useQuery` на `useInfiniteQuery`
  из TanStack Query для корректной работы с пагинацией.

### ⚡ Performance

#### TripWorker Optimization

- Убран `include: { bookings: true }` из начального запроса — брони больше не грузятся в память для всех просроченных поездок сразу.
- Добавлена батч-обработка по 100 поездок (keyset-pagination по `id`).
- Используется `select` (только `id`, `driverId`, `fromCity`, `toCity`) в начальном запросе.
- Брони перечитываются точечно внутри Serializable-транзакции каждой поездки.
- `tripsCount` подтверждённых пассажиров обновляется одним batch-UPDATE через `$executeRaw` вместо N запросов.
- Уведомления и WebSocket-рассылки вынесены в `Promise.allSettled` — сбой одного уведомления не блокирует остальные.

### 🗄️ Database

- Добавлен индекс для эффективной пагинации заявок поездки:
  - `Booking_tripId_createdAt_idx` (`tripId`, `createdAt DESC`)

### ⚠️ Breaking Changes

- **`GET /reviews/user/:userId`**: формат ответа изменился с массива на объект
  `{ items, pagination }`. Старые клиенты должны обновиться.
- **`GET /bookings/trip/:tripId`**: аналогичное изменение формата ответа.

### 🧪 Testing

- Добавлены integration tests для cursor-based пагинации отзывов
  (`backend/tests/integration/reviews-pagination.test.ts`).
- Добавлены integration tests для пагинации заявок поездки
  (`backend/tests/integration/bookings-pagination.test.ts`).
- Покрытие: дефолтный/custom limit, clamp 1-50, невалидный cursor → 400,
  expired cursor → пустая страница 200, обход страниц без пересечений, 404/403.
