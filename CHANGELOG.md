# Changelog

Все заметные изменения проекта документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### 🚀 Features

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
