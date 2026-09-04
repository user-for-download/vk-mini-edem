# Changelog

Все заметные изменения проекта документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added

#### Profile «Отзывы» Panel (SegmentedControl: Мои / О вас)

- Разрозненные секции отзывов в профиле («отзывы о вас» — 2 последних, «мои отзывы» — 3 последних) собраны в единый раздел «Отзывы» — отдельная панель `/profile/reviews` (ProfileView, lazy-chunk) с SegmentedControl по паттерну «История поездок» (`/bookings/history`):
  - **«Мои»** — все мои отзывы, включая ожидающие модерации (pending + published + rejected; `ReviewCard` показывает подписи «На модерации»/«Отклонён» для непубличных);
  - **«О вас»** — публичные отзывы о пользователе (`GET /reviews/user/:me`, только published), отфильтрованные по активной роли профиля — как у прежней секции.
- Профиль: вместо двух секций — одна клетка «Отзывы» (chevron) в группе «поездки и бронирования»; секции «поездки для отзыва» и CTA «Оставить отзыв» на месте (создание отзыва и e2e-сценарий не изменены).
- Без изменений API: вкладки строятся на существующих `GET /reviews/my` (отдаёт все статусы) и `GET /reviews/user/:userId` (published-only); запросы кешируются (кэш общий с ProfilePanel/DriverProfileModal). Пустое состояние с CTA «Оставить отзыв» (вкладка «Мои»), ошибка — «Попробовать снова», PullToRefresh, скелетоны `ReviewCardSkeleton`.
- Чистая логика вкладок — `helpers/reviewsTabs.ts` (`getReviewsForTab`, `REVIEW_TAB_OPTIONS`): unit-тесты без DOM; панель — SSR-рендер-тесты (конвенция репо без @testing-library).
- Tests: mini-app 126 (16 new: `reviewsTabs.test.ts` + `ReviewsPanel.test.tsx`).

#### Review Moderation (Модерация отзывов)

- Отзывы проходят админ-модерацию: новый отзыв создаётся со статусом `pending` («на модерации»), после чего администратор публикует его (`pending → published`) или отклоняет (`pending → rejected`). Approve/reject возможны только из `pending` (иначе `409 CONFLICT`); существующий `DELETE` работает из любого статуса и без изменений.
- Published-only: публичный `GET /api/v1/reviews/user/:userId` возвращает только `published` (pending/rejected скрыты); `rating`/`reviewsCount` пользователя агрегируются только по `published` — общий `recomputeUserRating` вызывается при **одобрении** (в той же Serializable-транзакции, что и смена статуса) и при **удалении**, но **не** при создании — pending-отзыв рейтинг не меняет.
- Admin API: `PATCH /api/v1/admin/reviews/:id/approve` (pending→published + пересчёт рейтинга + in-app уведомление автору `review_approved` «Отзыв опубликован»; 404 — отзыв не найден, 409 — статус не pending) и `PATCH /api/v1/admin/reviews/:id/reject` (pending→rejected, пересчёта нет, уведомление `review_rejected` «Отзыв отклонён»; 404/409 те же). `GET /api/v1/admin/reviews?status=pending|published|rejected` — необязательный фильтр; `AdminReviewDto` теперь включает `status`. Уведомления не критичные (подчиняются тумблеру `notificationsEnabled`), deep-link ведёт в «Мои отзывы».
- Mini-app: секция «Мои отзывы» в `ProfilePanel` — свои отзывы со статусом, до 3 последних (`GET /api/v1/reviews/my` теперь отдаёт `status` у каждого отзыва); `ReviewCard` показывает подпись статуса («На модерации»/«Отклонён») только для непубличных — в публичных списках (только published) её нет.
- Webapp: страница «Отзывы» — колонка «Статус» (бейджи: pending amber, published green, rejected red), кнопки «Одобрить»/«Отклонить» для pending (инвалидация кэшей списка + дашборда, sonner-тосты) и фильтр по статусу.
- DB: `Review.status String @default("pending")` + индекс `(targetUserId, status)` (миграция `20260903090000_add_review_status`); существующие отзывы backfill'ены в `published` — рейтинг не меняется.
- Contracts: `REVIEW_STATUS`/`REVIEW_STATUSES` в `status.const.ts`; `status` добавлен в `reviewSchema` (read) и `adminReviewDtoSchema`; опциональный `status` в `adminReviewsQuerySchema`.
- Docs: `docs/api/reviews.md` (статусы, published-only, лимиты), `docs/api/admin.md` (approve/reject + фильтр), `README.md`, `MEMORY.md`.
- Tests: backend 312 (17 new: `review-moderation.test.ts` + дополнения существующих сьютов), contracts 192 (31 new), mini-app 110 (13 new: `ReviewCard`, `CreateReviewModal`).

#### City Picker (VKUI `CustomSelect`) + Route Locking in Trip Edit

- Поля «Откуда/Куда» в `CreateTripModal`/`EditTripModal` теперь — VKUI `CustomSelect`-дропдаун (без третьего уровня модалки): один тап открывает searchable-дропдаун (подстрока, `filterFn`), выбор → готово. Справочник грузится одним запросом (`useAllCitiesQuery`, `staleTime: Infinity`), фильтрация — клиентская (O(N) по 25–200 городам — незаметно).
- `CityPickerField` получил `excludeCityId`: в `CreateTripModal` поле «Откуда» скрывает выбранный «Куда» (и наоборот) — UX-страховка, подкреплённая серверным refine `fromCityId !== toCityId`. Текущий выбранный город помечен `disabled` в options.
- **Маршрут заблокирован в `EditTripModal`:** поля `disabled` + helperText «Маршрут нельзя изменить после создания…»; внизу формы — «Опасная зона» с кнопкой «Удалить поездку» (активна только при `status === "active"` и отсутствии активных броней), использующей `PATCH /trips/:id/cancel`.
- Backend отвергает смену маршрута в `PATCH /trips/:id`: `updateTripDtoSchema = baseTripSchema.partial().omit({ fromCity, fromCityId, toCity, toCityId }).strict()` — эти поля в теле PATCH → `400`. Бэкенд больше не резолвит FK и не декрементит `tripsCount` в PATCH (код удалён).
- `citySuggestQuerySchema.q` стал опциональным (пустое/отсутствующее → весь справочник); `CITY_SUGGEST_LIMIT_MAX` поднят 20 → 100 для клиентской загрузки всего списка.
- Бандл: 271 KiB initial gzip (было 316 — минус 45 KiB после удаления `CityAutocomplete`/варианта `ModalPage`). Под лимитом 330 KiB.
- Docs: `docs/api/admin.md` (эндпоинты городов), `MEMORY.md` (раздел City Picker + Locked Route).

#### City Directory (Справочник точек) + Trip Form Autocomplete

- Админский справочник точек для малого городка. UI мини-апа **не позволяет** вводить город вручную — только выбор из справочника. Место посадки (адрес) остаётся свободным текстом водителя.
- 25 точек Вологодской области засеяны идемпотентно в `prisma/seed.ts` (`seedCities`, `findFirst` по `nameNormalized` + create/update). Повторный запуск seed не пересоздаёт города и не трогает админские правки.
- Soft-reference: `Trip.fromCity`/`toCity` остаются строками-снимками (источник правды для UI/поиска/уведомлений); новые nullable FK `Trip.fromCityId`/`toCityId` → `City` (`ON DELETE SET NULL`, денормализованный `City.tripsCount`).
- DTO ужесточены: `createTripDtoSchema`/`updateTripDtoSchema` требуют `fromCityId`/`toCityId` (`z.string().uuid()`) + refine `fromCityId !== toCityId`. Старые клиенты без `fromCityId` → `400 VALIDATION_FAILED`. Неизвестный город (404 на `findUnique`) → `400 CITY_NOT_FOUND`.
- Публичный `GET /api/v1/cities/suggest?q=&limit=` (без auth, IP-лимит, `mode: "insensitive"` contains). Админ `GET/POST/PATCH/DELETE /api/v1/admin/cities` (adminGuard, mutationLimiter); `409` на дубликат имени; `409` на удаление используемого города (`tripsCount > 0`).
- `tripsCount` инкрементируется при создании Trip (Serializable tx), декрементируется при смене FK через PATCH. Отмена поездки счётчик не меняет.
- Contracts: `city.schema.ts` + `city.dto.ts` (`CITY_NAME_MAX_LENGTH = 100`, `CITY_SUGGEST_LIMIT_MAX`, хелперы `normalizeCityName`/`cityNameNormalized`). Уникальный индекс `City_nameNormalized_key` создаётся SQL-миграцией (Prisma не поддерживает unique с выражением).
- Webapp: страница `/cities` (поиск с дебаунсом 300 мс, пагинация, диалоги создания/переименования/удаления; удаление заблокировано в UI при `tripsCount > 0`).
- Docs: `docs/api/admin.md` (эндпоинты городов).

#### Admin Feedback Reply (Support Loop)

- Админ теперь может ответить на обращение в поддержку — замыкается цикл «пользователь → админ → пользователь». `Feedback.reply String?` + `Feedback.repliedAt DateTime?` (+ индекс по `repliedAt` для будущих метрик «ожидают ответа»). `repliedAt` — аудит **первичного** ответа, при правке не двигается.
- Admin API: `GET /admin/feedback/:id` (детальная карточка, 404 для неизвестного id); `POST /admin/feedback/:id/reply` (первичный ответ — создаёт in-app уведомление `feedback_replied`, `400` если ответ уже есть → используйте PUT); `PUT /admin/feedback/:id/reply` (редактирование, не двигает `repliedAt`, `400` если ответа ещё нет → используйте POST). Тело `feedbackReplyBodySchema` `{ reply }` (trim, 1–2000). Список `GET /admin/feedback` теперь включает `reply`/`repliedAt` в элемент.
- User API: `GET /api/v1/feedback` — собственные обращения авторизованного пользователя (новые первыми, bare array) с `reply`/`repliedAt` (`UserFeedbackDto`).
- Mini-app: раздел «Мои обращения» в SupportPanel + read-only модалка деталей (`useMyFeedbacksQuery`); инвалидация кэша после успешной отправки. Webapp: master-detail с формой ответа/редактирования (счётчик символов + валидация).
- Docs: `docs/api/admin.md` (эндпоинты reply + поля списка), `docs/api/feedback.md` (`GET /api/v1/feedback` + поля reply).

#### Real VK Push Notifications For Key Events

- Реальные push-уведомления VK на ключевые события: подтверждение/отклонение брони (пассажиру), отмена поездки (пассажирам), завершение поездки (пассажирам + водителю). Доставляются через `notifications.sendMessage` (серверный метод, **сервисный ключ** мини-аппа), приходят даже при закрытом приложении. Это **отдельный** механизм от уже существующих сообщений сообщества (`messages.send`, `VK_GROUP_TOKEN`) — оба могут сосуществовать.
- Backend: новый fail-safe сервис `services/vkPush.ts` (`sendVkPush(vkUserId, message, fragment?)`, таймаут 8 с, глотает ошибки) + env `VK_SERVICE_KEY` (опц., не задан → push не отправляются, остальной бизнес-флоу не ломается). Подключён в `createNotification` для `CRITICAL_NOTIFICATION_TYPES` (покрывает бронирования, поездки и фоновый worker автозавершения без правки каждого call-site'а — кроме добавления `fragment` для deep-link). В call-sites передаются маршруты мини-аппа для `fragment`: `/bookings` (бронь/отмена), `/bookings/history` (завершение → отзыв), `/trips/my` (водителю при автозавершении). Роутер `createHashRouter` — `fragment` попадает в hash, никаких изменений в deep-link-парсере не требуется.
- Mini-app: `requestNotificationsPermission` в `helpers/bridge.ts` (VK Bridge `VKWebAppAllowNotifications`, graceful `unsupported/cancelled/failed/success`). `NotificationsPanel`: отдельный блок «Push-уведомления VK» — читает текущий статус из `vk_are_notifications_enabled` (паттерн гонки с таймаутом 3 с, как в `useAuthStore`, чтобы UI не зависал вне VK) и предлагает «Включить»/показывает «Включены». После успешного запроса — оптимистичное обновление статуса.
- Безопасно: критичные уведомления (и push) создаются/доставляются **независимо** от персонального тумблера `notificationsEnabled` (бизнес-контракт). VK push дополнительно не зависит от тумблера — это реальные «критичные» события. Сообщество-сообщения и push — два независимых согласия (отдельные UI в `NotificationsPanel`).
- Внешняя настройка (one-time): получить сервисный ключ в консоли VK (dev.vk.com → Настройки мини-аппа → Сервисный ключ) и задать `VK_SERVICE_KEY` в `backend/.env` / root `.env`. Без ключа push не отправляются (приложение работает).
- Docs: `backend/ENVIRONMENT.md` (раздел «VK push notifications»), `README.md` (feature + env-таблица), `MEMORY.md`.
- Tests: backend 248 (12 new: 7 `vkPush.test.ts` + 5 `notification-push.test.ts`), contracts 100, mini-app 89 (5 new: `requestNotificationsPermission` в `bridge.test.ts`).

#### VK Direct Message «Написать в VK» Button

- Координация между водителем и пассажиром через уже существующие личные сообщения ВКонтакте (свой чат не строится). После создания брони и после подтверждения рядом появляется кнопка «Написать в VK», открывающая диалог с контрагентом: `https://vk.com/im?sel={vkUserId}` через существующий `openExternalUrl` (`VKWebAppOpenUrl` + браузерный фолбэк). Подпись явно указывает, что переписка откроется во ВКонтакте, а не в приложении.
- Дозированная выдача `vkUserId` (по аналогии с точными адресами встречи, fail-closed): поле добавлено в `userSchema` (optional positive int) и отдаётся только участникам активной брони — `GET /trips/:id` (driver.vkUserId при `canSeePrivateDetails`), `GET /bookings/my` (driver.vkUserId), `GET /bookings/trip/:tripId` (passenger.vkUserId, эндпоинт и так только для водителя). В публичные выдачи (поиск поездок, публичные профили, отзывы, `/bookings/history`) поле не попадает. Сериализаторы получили опцию `includeVkUserId` (по умолчанию `false`; кладётся только при non-null).
- Mini-app: новый чистый хелпер `helpers/vkLink.ts` (`buildVkMessageUrl` + `openVkMessages`). Кнопка «Написать в VK» показывается только при активном статусе (pending/confirmed) и наличии `vkUserId` в четырёх точках: `TripDetailsPanel` (пассажир, рядом с «Отменить бронирование»), `PassengerTripCard` («Мои брони»), `BookingRequestRow` («Заявки» водителя), `TripPassengerRow` (подтверждённые пассажиры в деталях рейса водителя).
- Tests: backend 236 (10 new: `vk-dm-disclosure.test.ts`), contracts 100 (4 new: `user.schema.test.ts`), mini-app 84 (11 new: `vkLink.test.ts`, `vkWriteButton.test.tsx`).

#### Ban Screen Feedback Appeal

- Ban screen «Обратная связь»: the «Обновить» button on the banned screen is replaced with a single «Обратная связь» button (mode primary) that opens the existing `FeedbackModal` with the subject pre-filled «Обжалование блокировки» (`openFeedbackModal(modalApi, { initialSubject })`, `FeedbackModal.initialSubject?` prop — `SupportPanel` usage unchanged).
- Public appeal endpoint `POST /api/v1/feedback/appeal` (no auth — banned users have no token): the body `{ searchParams, subject, text }` is validated by `feedbackAppealDtoSchema` (searchParams ≤ 4096, subject/text reuse `FEEDBACK_SUBJECT_MAX_LENGTH`/`FEEDBACK_TEXT_MAX_LENGTH`); identity is proven by the signed VK launch params via `verifyVkLaunchSignature` (the same check as `/auth/vk`, dev-sign accepted under `ALLOW_DEV_AUTH`) — no tokens are issued. Unknown signature → 401, unknown user → 404, invalid body → 400 `VALIDATION_FAILED`. Dedicated rate limiter: 5 requests/hour per IP (429 beyond). The feedback row is linked to the resolved user, so the admin panel sees who wrote it.
- Mini-app: `useAuthStore.launchParams` stores the VK launch-params string on the banned path; `useCreateFeedbackMutation` routes automatically — token present → `POST /feedback`, no token → `POST /feedback/appeal` with the stored launch params (no token + no launch params → graceful error snackbar).
- Docs: new `docs/api/feedback.md` (user feedback endpoints).
- Tests: backend 226 (17 new: `feedback-appeal.test.ts`), contracts 96 (13 new: `feedbackAppealDtoSchema`), mini-app 73 (10 new: `useFeedbackQuery.test.ts`, `feedbackModal.test.ts`, `AuthGate.test.tsx`).

#### Ban Reason And Banned-User Screen

- Ban reason is persisted: `User.banReason String?` (migration `20260827120000_add_user_ban_reason`; `null` for bans made before this feature). The admin user payload (`serializeAdminUser`/`adminUserDtoSchema`) now includes `banReason: string | null`.
- Login-time ban enforcement: `POST /auth/vk` checks `bannedAt` after the user upsert (covers both real VK and dev-auth flows) and rejects banned users with `403 { code: "FORBIDDEN", message: "Account is banned", banReason: string | null }` — no tokens are issued and all active refresh tokens are revoked (`revokeAllActiveTokens`). `POST /auth/refresh` returns the same 403 shape including `banReason` in both the regular and dev-mock branches.
- Admin ban requires a reason: `PATCH /admin/users/:id/ban` takes `{ reason }` validated by `banUserBodySchema` (trim, 1–500 chars, `.strict()` — extra fields rejected). Invalid/missing reason → `400 { code: "VALIDATION_FAILED", message, errors }`. A valid ban persists `bannedAt` + `banReason`, immediately closes the user's open WebSocket connections (`4403`), and does NOT auto-cancel their trips. Re-banning is idempotent and overwrites both the timestamp and the reason. `PATCH /admin/users/:id/unban` clears both `bannedAt` and `banReason`.
- Mini-app: new auth status `banned`. Bootstrap recognizes the 403 `FORBIDDEN` response and `AuthGate` renders a ban screen instead of the app: «Аккаунт заблокирован», «Причина: {banReason ?? "Причина не указана"}» and a «Обратная связь» button (see Ban Screen Feedback Appeal). A mid-session ban also lands on the screen immediately: WS close `4403` → refresh 403 → `apiClient.onBanned` event.
- Webapp: banning now happens via a modal with a required reason textarea (1–500 chars, live counter, validation) instead of a confirm dialog; the users list shows `banReason` with the fallback «Причина не указана». Unban is unchanged.
- Tests: backend 209 (25 new: `auth-ban-reason.test.ts`, `admin-ban-reason.test.ts`), contracts 83 (18 new: `admin.schema.test.ts`), mini-app 63 (15 new: `useAuthStore.test.ts`, `client.test.ts` extensions).

#### Admin Panel (`webapp/` workspace)

- New `webapp/` workspace: admin panel on React 19 + Vite 6 + Tailwind 4 + shadcn/ui + TanStack Router/Query. Sections: Dashboard (metrics), Users (search, ban/unban), Trips (filter, admin cancel), Bookings (filter, status override), Reviews (delete), Settings (read-only env snapshot). Dev server runs on port **3013** and proxies `/api` to the backend, so admin auth cookies are same-origin.
- Admin API under `/api/v1/admin`: dashboard metrics; paginated users/trips/bookings/reviews; `PATCH /users/:id/ban|unban`; `PATCH /trips/:id/cancel`; `PATCH /bookings/:id/status`; `DELETE /reviews/:id`; `GET /settings`. Admin trip cancel changes status only (no booking cascade); admin ban does NOT auto-cancel the user's trips.
- Admin auth: single-field login with the static `ADMIN_TOKEN` (`POST /api/v1/admin/auth/login`, wrong token → 401). On success the backend sets an **httpOnly cookie** `edem_admin_jwt` with a 12-hour JWT (`type=admin-access`, `sub=admin`, TTL via `ADMIN_JWT_TTL_SECONDS`); the token never touches localStorage or JS. `GET /auth/session` reports session state for the frontend route guard (always 200); `POST /auth/logout` clears the cookie. Guarded endpoints return **401** without a valid session.
- Admin panel is closed by default: with `ADMIN_TOKEN` unset every admin request (including login) gets 403 in all environments.
- Admin login is rate-limited against brute force: `ADMIN_LOGIN_RATE_WINDOW_MS`/`ADMIN_LOGIN_RATE_MAX` (default 5 requests / 5 minutes per IP).
- User ban: `User.bannedAt DateTime?` (migration `20260825142000_add_user_banned_at`); `requireAuth` rejects banned users with 403 on every authenticated endpoint.
- Admin contracts in `packages/contracts`: query/body schemas and DTOs (`adminLoginBodySchema`, `adminLoginResponseSchema`, `adminSessionResponseSchema`, paginated admin DTOs).
- Backend integration suite `admin-auth.test.ts` (18 tests): login ok/wrong/invalid/disabled, Secure-flag handling via `X-Forwarded-Proto`, session states, guard cookie verification incl. user-token type-confusion rejection, logout idempotency.

#### Admin Panel Production Deployment

- `docker-compose.yml` now ships the admin panel: new `webapp` service (multi-stage `webapp/Dockerfile`: vite build → `nginx:1.27-alpine`) serving `webapp/dist` on published port **3014** (`WEBAPP_BIND_ADDR` in root `.env`, default `127.0.0.1`). The embedded nginx config (`webapp/nginx.conf`) serves the SPA with `index.html` fallback and proxies `/api` to `backend:3000` inside the docker network, keeping the `edem_admin_jwt` cookie same-origin.
- `docker-compose.yml` passes `ADMIN_TOKEN` / `ADMIN_JWT_TTL_SECONDS` to the backend (empty `ADMIN_TOKEN` keeps the panel disabled).
- Admin cookie `Secure` flag is now derived from `X-Forwarded-Proto` (the webapp nginx forwards the upstream value or the connection scheme): HTTPS → `Secure`, HTTP → no `Secure`, so admin login works on HTTP-only domains behind a proxy. Without the header the previous behavior applies (`secure = isProduction`).

#### Onboarding (Mini App)

- First-launch onboarding via VK Bridge `VKWebAppShowSlidesSheet` (native information screens): 3 slides — «Находите поездки», «Бронируйте места», «Оставляйте отзывы». Shown once after the first successful auth (mini-app `App` renders inside `AuthGate`); any outcome (viewed all / skipped / closed / method unsupported / error) marks onboarding done, following the VK recommendation not to re-push skipped onboarding. The done flag is stored in VK cloud storage (`VKWebAppStorageSet`, per user+app) with a `localStorage` fallback. Slide images are temporary placeholders (832×555, 1.5:1, ≤ 500 KB per VK requirements) loaded as base64 via Vite `?inline` imports; slides live in a lazy chunk, so the initial bundle is unaffected (bundle budget check passes). Bridge wrappers `showSlidesSheet` / `vkStorageGet` / `vkStorageSet` never throw — unavailability degrades to `unsupported`/`failed`/`null`/`false`.

#### Onboarding Flag Backend + Admin Reset

- The onboarding done-flag moved from VK cloud storage (`VKWebAppStorageSet` with a `localStorage` fallback) to the backend: `User.onboardingVersion String?` (migration `20260827101541_add_user_onboarding_version`). The mini-app compares the stored version with its own `ONBOARDING_VERSION` (`mini-app/src/onboarding/version.ts`, pure `shouldShowOnboarding` helper) and completes onboarding via `POST /api/v1/users/me/onboarding` (auth required, `mutationLimiter`, body `{version}` — trimmed string 1..50 chars, otherwise 400 "Invalid payload"); the serialized user (`serializeUser`/`userSchema`) now exposes `onboardingVersion` (`null` = not completed or reset). Versioning: bumping `ONBOARDING_VERSION` makes ALL users see the new slides once. The VK storage bridge helpers `vkStorageGet`/`vkStorageSet` and `onboardingStorage.ts` were removed.
- Admin reset: `PATCH /api/v1/admin/users/:id/onboarding-reset` (admin-cookie guard, 404 for a missing user, idempotent) nulls `onboardingVersion` so the user sees the slides again on next launch; the webapp Users page adds a «Сбросить онбординг» action with a confirm dialog (`resetOnboarding` API method + `useResetOnboardingMutation`).
- Contracts: `completeOnboardingBodySchema` (`{version}`, `.strict()`, trim + min 1 + max 50) and `userSchema.onboardingVersion` (nullable optional string). Tests: integration suite `onboarding.test.ts` (auth, validation, persistence, admin guard/404/reset) and extended contract tests in `user.schema.test.ts`.

#### Feedback (Обратная связь)

- Support feedback form in the mini-app: Профиль → Помощь и поддержка → «Связаться с нами» → button «Обратная связь» (replaces the former placeholder text). Opens a `ModalPage` form styled like EditProfileModal (header with close button, `Group` with FormItems, sticky bottom submit): «Тема» input (≤ 100 chars) + «Сообщение» textarea (≤ 2000 chars, live counter) + «Отправить». Success/error snackbars; client-side validation mirrors the contract limits (`FEEDBACK_SUBJECT_MAX_LENGTH` / `FEEDBACK_TEXT_MAX_LENGTH` exported from `@edem/contracts`). The modal chunk loads lazily (`openFeedbackModal` helper, `loadModule` pattern).
- New backend endpoint `POST /api/v1/feedback` (auth required, `mutationLimiter`, DOMPurify sanitization, zod validation, trim before save, business event `feedback.created`) and Prisma model `Feedback` (`id, userId, subject, text, createdAt`, cascade delete with user, index on `createdAt desc`) — migration `20260826112025_add_feedback`.
- Admin panel: new read-only section «Feedback» (`/feedback`, LifeBuoy icon in the sidebar) listing submissions newest-first with offset pagination (date, user, subject, message), backed by `GET /api/v1/admin/feedback` (admin-cookie guard, `adminFeedbackQuerySchema`, `AdminPaginatedFeedback` DTO, `serializeAdminFeedback`).
- Contracts: `feedback.dto.ts` (`createFeedbackDtoSchema`, `createFeedbackResponseSchema`, length constants) + admin feedback DTO/query schemas; 13 new contract tests. Integration tests: `feedback.test.ts` (9) and `admin-feedback.test.ts` (6).

#### Full-Cycle E2E

- `e2e/full-cycle.mjs` (Playwright + Chromium): 14-step driver→passenger flow — driver auth, search accordion, trip creation, passenger search and booking, driver confirmation, snackbar/status checks, trip completion, passenger review. Artifacts: `e2e/shots/`, `e2e/results.json`.

### Changed

#### Prisma 5.22 → 7 Upgrade (driver-адаптер + prisma.config.ts)

- Бэкенд переехал на Prisma ORM 7 (7.10.x): `prisma ^7`, `@prisma/client ^7`, `@prisma/adapter-pg ^7`, `pg ^8` (workspace `backend`). Rust-движок удалён — клиент генерируется чистым TS, бинарных движков нет (в alpine-образе `binaryTargets` больше не нужны).
- `datasource.url = env("DATABASE_URL")` из схемы удалён (в v7 не поддерживается): URL переехал в **`backend/prisma.config.ts`** (`defineConfig` из `prisma/config`; `datasource.url` с placeholder-фолбэком, чтобы `prisma generate` работал без окружения, например при сборке Docker-образа). `.env` в v7 **не подгружается автоматически** (ни CLI, ни клиентом): конфиг явно читает `backend/.env` (путь относительно файла), `seed.ts`/`drop-tables.ts` — аналогично, приложение — через `env.ts`.
- Генератор: `prisma-client-js` → **`prisma-client`** (ESM): вывод в **`backend/src/generated/prisma`** (gitignored, компилируется tsc в `dist`); все 19 импортов бэкенда теперь из `.../generated/prisma/client.js`; рантайм — `@prisma/client` v7 (`runtime/client`).
- Подключение — через **pg driver-адаптер** `PrismaPg` в `src/db.ts`: `max: 10`, `connectionTimeoutMillis: 10_000` (node-pg игнорирует стартовые параметры Rust-движка `connection_limit`/`pool_timeout` из URL, поэтому пул задан в коде; `statement_cache_size` в CI-URL тоже no-op).
- **Изменилась форма `meta` у P2002**: `meta.target` (поля индекса) больше не отдаётся — данные PG-драйвера теперь в `meta.driverAdapterError.cause` (`originalCode: 23505`, `constraint.index` — ИМЯ нарушенного unique-индекса). Классификация гонок броней (POST /bookings, админская смена статуса брони) — по имени индекса через `getUniqueConstraintName()` (`src/utils/prisma-errors.ts`): `active_seat_booking` → SEAT_TAKEN/идемпотентный 200, `active_passenger_booking` → ALREADY_BOOKED, остальное — общий 409. Прочие проверки P2002/P2034 используют только `error.code` — без изменений.
- В v7 `migrate dev`/`db push` больше не запускают `prisma generate` автоматически, а `@prisma/client` — не генерируется при установке: скрипты `db:migrate`/`db:push`/`db:push:force`/`db:test:push` цепляют `&& prisma generate`; корневые `npm run dev`/`npm run build` вызывают `db:generate` на старте (после `git pull` с изменённой схемой — `npm run db:generate`).
- Dockerfile (prod): stage 2 копирует `backend/prisma.config.ts` в `/app` (`CMD` `npx prisma migrate deploy` читает его; URL — из docker-compose). tsconfig бэкенда: `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` (внутренние импорты сгенерированного клиента используют расширение `.ts`).
- Node ≥ 22 теперь жёстко требуется для бэкенда (engines + зависимости Prisma 7).
- Verified: `prisma validate`, `db:push` (dev и test БД — «already in sync»), `tsc --noEmit` (все воркспейсы), backend-тесты 313/313 (edem_test), `npm run build`, smoke собранного dist на Node 22 (health + GET /trips через адаптер, graceful shutdown), `docker build` + `prisma validate` внутри образа, `format:check`.

#### Review Length Limit + Popover Removal

- Лимит текста отзыва: `REVIEW_TEXT_MAX_LENGTH = 150` (константа в `packages/contracts`, экспорт из `@edem/contracts`) enforced **на запись** — `createReviewDtoSchema.text` теперь `.trim().min(1).max(150)`. Read-схема `reviewSchema.text` намеренно остаётся `max(1000)` — терпимая и неблокирующая (fail-closed) для существующих отзывов.
- Mini-app `ReviewCard`: полный текст отзыва — в multiline `SimpleCell` (перенос строк, без ellipsis); **Popover с полным текстом удалён** (и chevron) — при лимите 150 символов текст занимает ~3 строки на телефоне, карточка самодостаточна.
- `CreateReviewModal`: лимит 150 через импорт константы из contracts (вместо локального 1000), живой счётчик `N/150` (красный за 50 символов до лимита), валидация «Максимум 150 символов»; success-снэкбар — «Отзыв отправлен на модерацию» («Он появится в профиле после одобрения»).

#### Drop Pending Verification (VK auth = verified)

- Ручная модерация верификации (none/pending/rejected → approved) больше не нужна: аутентификация через подписанные VK launch-параметры — это и есть верификация. Prisma: drop `User.verificationStatus`; `isVerified` по умолчанию `true`; `verifiedAt` проставляется при upsert в `/auth/vk` (defensive backfill `isVerified=true` для старых строк выполняется перед drop колонки).
- Backend: удалён `POST /me/request-verification`; auth upsert всегда верифицирует пользователя. Contracts: убраны `verificationStatus` / `verificationStatusSchema` из `userSchema` + `adminUserDtoSchema`.
- Mini-app ProfilePanel: убрана кнопка «Пройти верификацию» и ветка «На рассмотрении» — всегда «Личность подтверждена ВКонтакте». Webapp UsersPage: убрана колонка «Верификация» и бейджи.

#### Vite 6 → 8 (Rolldown + Oxc) + Dependency Bumps

- `vite` 6.2.3 → **8.2.2** (root + webapp; mini-app — hoisted в root): сборка теперь на бандлере **Rolldown** + **Oxc**. Функциональная форма `manualChunks` → `build.rolldownOptions.output.codeSplitting.groups`; `__dirname` → `import.meta.dirname`; `esbuild` убран из root devDeps (его заменил Rolldown). `@vitejs/plugin-react` остаётся 5.2.0 (peer уже поддерживает vite 8). Время сборки 12.3 с → 1.3 с; initial JS −40 kB.
- Фикс только для dev: consistent CJS interop в Vite 8 (importer `type:module`) делал default-экспорт `@vkontakte/vk-bridge-mock` (его `browser: UMD`-сборка) целым объектом `exports`, ломая `bridgeMock.send`/`isWebView` в dev-окружении. Алиас на чистый ESM-вход `dist/index.es.js` в `mini-app/vite.config.ts`. Prod-сборка не затронута (реальный `@vkontakte/vk-bridge` — чистый ESM).
- Обновление зависимостей (патчи/миноры, без breaking changes): `@sentry/node` + `@sentry/react` 9 → **10.73.0** (используются только `init`/`capture*`/`ErrorEvent` — код-совместимо, OTel v2 подтянут автоматически), `@vkontakte/vkui` 8.3.1 → 8.4.0, `@vkontakte/icons` 3.64 → 3.68, `hono` 4.12 → 4.13.5, `jose` 6.2.8 → 6.2.10, `zod` 4.4.3 → 4.5.4, `zustand` 5.0.14 → 5.0.15, `tsx` → 4.23.13, `vitest` 4.1.10 → 4.1.11, `@tanstack/react-query` 5.101 → 5.102.8. Корневой `package.json` (манифест унификации версий) синхронизирован с воркспейсами.

#### Mini-app UI Rework (reviews + driver rows)

- Карточка отзыва переосмыслена: строка `SimpleCell` (полный текст — в multiline-режиме; Popover с полным текстом, добавленный в этом же цикле, удалён фичей модерации — см. «Review Moderation» в Added); оценка показывается кубиком `Dice` по значению (1–5); исправлено переполнение `Box` в VKUI 8.4.
- `BookingRequestRow` («Заявки» водителя) и `TripPassengerRow` (подтверждённые пассажиры) переведены на единый `RichCell`-шаблон: аватар в `before` (у пассажира + рейтинг `Avatar.Badge`), имя + «Место N» в `overTitle`, комментарий/маршрут в `subtitle`, кнопка «Написать в VK» в `after` (pending/confirmed + наличие `vkUserId`), действия водителя (принять/отклонить) — `ButtonGroup` (только pending).
- Устаревший `<Div>` заменён на `<Box>` (ReviewCard, панели Privacy/Terms); `StarPicker` — иконка-сердце + невидимая рамка кнопки; `CreateReviewModal` мигрирован на `ModalPage`.

- Maximum seats per trip reduced from 4 to 3 (`MAX_SEATS` in shared contracts): at most 2 passengers on the rear seat for comfort. Applies to trip create/edit validation, booking seat validation, and the seat picker. The create/edit forms show a hint under the seats field: «Не более 3 мест: на заднем сидении — только 2 пассажира, для комфорта». Seed data and tests updated accordingly.
- Trip creation/edit forms take travel time in whole hours («Время в пути, часов»: 3, 4, 5…) instead of minutes; the value is converted to `durationMinutes` (×60) at the form boundary. Storage, API contract, and overlap checks are unchanged.
- Seed durations are whole hours (120–540 min) to match what the hours-based form produces; re-running the seed refreshes all departure dates relative to now.

### Fixed

- `City.nameNormalized`: добавлен `@unique` в Prisma-схему (SQL-миграция уже создавала уникальный индекс `City_nameNormalized_key`, но атрибут в схеме отсутствовал — `prisma validate`/CI ловил дрейф).
- e2e `full-cycle.mjs`: навигация по месяцам в календаре, перезагрузка отзывов и селектор push-уведомлений; поток теперь 15 шагов (15-й покрывает блок «Push-уведомления VK» в `/profile/notifications`).
- Убран мёртвый код `dto.fromCity`/`toCity` из `importantFieldsChanged` в `backend/src/trips` (маршрут в PATCH заблокирован — см. City Picker).

#### VK Profile Sync On Login

- Users are no longer stuck with the «Пользователь VK <id>» placeholder and default avatar: the mini-app now fetches the profile via VK Bridge `VKWebAppGetUserInfo` (with a 3s timeout) and sends `firstName`/`lastName`/`photo` with the `/auth/vk` payload (fields restored to `authRequestSchema`); the backend saves them as display data. VK launch params (`first_name`/`last_name`/`photo`) are kept as a per-field fallback. Avatars are accepted only over https from VK CDN hosts (`*.userapi.com`, `*.vk.com`, `*.vk.ru`, ...) — arbitrary URLs are rejected. The avatar re-syncs from VK on every login (it is not editable via API); the name replaces only the placeholder, so names edited via `PATCH /users/me` are never overwritten. Existing placeholder users pick up their VK name on next login. The fields are unsigned (VK signs only `vk_*` params) and remain display-only — identity and `isVerified` still come from the signed `vk_user_id`.

#### Search Filters Accordion

- «Выбор даты» in trip search is now a VKUI `Accordion` (collapsed by default) instead of a toggle button; date filters live in `Accordion.Content` and expand with the summary chevron.

#### Trip Tags Section Insets

- «Особенности поездки» in trip details renders tag badges directly in the Group without a card frame (16px padding — explicit pixel values that do not depend on VKUI theme tokens).

#### Booking Status Text Duplication

- Passenger booking status in trip details no longer duplicates the confirmation wording: the parenthetical status was removed from the `FormStatus` title («Заявка на место No3 отправлена», «Место No3 забронировано»), the status is conveyed by the body text only («Ожидайте подтверждения от водителя.», «Водитель подтвердил вашу бронь. Приятной поездки!»).

#### Russian Pluralization And Empty Requests Section

- Profile modal: «22 поездок» → «22 поездки» — trip count now uses a shared `pluralRu` helper (1 поездка / 2 поездки / 5 поездок); the duplicated local `pluralSeats` helpers in TripCard and TripsManagePanel were deduplicated onto it.
- Trip details: the «Управление заявками (0)» section no longer renders when there is nothing to manage. With only confirmed passengers the group is titled «Подтвержденные пассажиры (N)»; with no bookings at all the section is omitted entirely.

#### Passenger Profile Modal

- Drivers can now open a passenger's profile (info + reviews) from trip details and the trip requests panel: the confirmed-passenger row is fully clickable, and request rows have a clickable avatar. The shared profile modal takes an optional role title («Профиль пассажира»); previously only the driver's profile was reachable.

#### Driver Booking Requests Order

- In trip details, pending booking requests now render directly under «Управление заявками» instead of below the «Подтвержденные пассажиры» block — requests require driver action and come first. The confirmed-passengers subsection title now uses the same VKUI `Header` as the group title (consistent typography and insets).

#### CI: Backend Bookings Pagination Tests

- `bookings-pagination.test.ts` created bookings with `seat: (i % 4) + 1`; after the MAX_SEATS=3 change the fail-closed response validation rejected seat 4 with 500. Seats now cycle 1..3.
- Backend vitest now aliases `@edem/contracts` to the TypeScript source instead of the built `dist`: a stale contracts build silently validated responses against the old schema and masked the failure locally while CI (fresh build) caught it.

#### Terms And Privacy Panels Full-Bleed Text

- «Пользовательское соглашение» and «Политика конфиденциальности» paragraphs no longer touch the screen edges on phones: VKUI `Paragraph` has no intrinsic padding and `Group modeNone` adds none at small view widths. All paragraphs are wrapped in `Div`, aligning text with the section headers' 16px inset.

#### Home Banner Full-Bleed On Phones

- The «Едьте дешевле поезда» / «Едете куда-то за рулём?» banners no longer stretch edge-to-edge on phones: VKUI `Group modeNone` resolves `--vkui_internal--Group_card_mode_padding_size` to 0 at small view widths (the card padding rule only applies from small tablet up), so the banner lost horizontal insets. Both banners are now wrapped in `Box padding="system"`, matching the neighboring search block.

#### Driver Profile Modal Overflow

- Review rows no longer overflow the modal horizontally: `Accordion.Summary` (built on VKUI `SimpleCell`, `white-space: nowrap` by default) rendered the «Маршрут · дата» subtitle as one unbreakable line, pushing the row past the card edge and clipping the star rating in the `after` slot. `multiline` is now set so the subtitle wraps.

#### Trip Address Visibility (`GET /trips/:id`)

- Trip details no longer mask exact meeting addresses for trip participants: the driver and users with an active booking (pending/confirmed) now receive real `fromAddress`/`toAddress`. Previously the endpoint masked for everyone, so drivers saw their own departure point duplicated as «Москва / Москва» in trip details.
- Public masking now omits the address fields entirely instead of substituting the city into them, eliminating fake duplication on public search cards.
- `fromAddress`/`toAddress` are optional in the shared `tripSchema`; `RouteLine` already rendered missing addresses correctly.
- New integration suite `trip-address-visibility.test.ts` covers driver, stranger, pending/confirmed/cancelled booking visibility, and the public list.

### Bugfix Remediation (2026-08-27)

All 21 findings from the full logic-bug review are resolved: 7 Medium, 14 Low. Plus one same-class follow-up (review text whitespace). New regression coverage: 18 backend integration tests (`ban-enforcement.test.ts` — 5, `admin-moderation.test.ts` — 11, `trips-search-departed.test.ts` — 2) and 12 contract tests.

#### Security: Ban Enforcement

- Ban is now enforced on every auth path, not just `requireAuth`: `/auth/refresh` checks `bannedAt` before issuing tokens (banned → all active refresh tokens revoked + `403`), WebSocket authentication performs a DB lookup and closes banned connections with code `4403`, and `optionalAuth` treats banned users as guests (no user attached, so banned users no longer see private trip addresses via `GET /trips/:id`).
- Admin ban (`PATCH /admin/users/:id/ban`) now immediately closes all open WebSocket connections of the banned user (`4403`).
- `requireAuth` no longer masks database outages as `401`: the try/catch now covers only JWT verification; DB lookup failures propagate to the global handler as `500`, so clients no longer drop valid sessions during a DB outage.
- Refresh-token reuse detection is hardened: token-family revocation runs in its own try/catch — a revocation failure still returns `401` and the security event is always logged.

#### API And Contracts

- Admin trip cancel (`PATCH /admin/trips/:id/cancel`) is guarded by status: completed and cancelled trips are rejected with `409 TRIP_NOT_ACTIVE` (previously a completed trip could be flipped to cancelled, stripping passengers of review eligibility while keeping `tripsCount`).
- Admin booking status change (`PATCH /admin/bookings/:id/status`) now keeps seat accounting consistent: moving an active booking to `declined`/`cancelled` restores `seatsAvailable`, reactivating a booking re-holds a seat (409 if none free or the seat is taken), and unique-index conflicts (`P2002`) return `409` (`SEAT_TAKEN`/`ALREADY_BOOKED`/`BOOKING_CONFLICT`) instead of `500`. Runs in a Serializable transaction like the driver endpoint.
- Admin review delete (`DELETE /admin/reviews/:id`) recomputes the target user's `rating`/`reviewsCount` in the same transaction (shared `recomputeUserRating` helper, also used by review creation) — deleted reviews no longer count in the rating forever.
- Trip search (`GET /trips`) no longer returns already-departed trips (they stayed listed up to 24h until the auto-completion worker ran, sorted first, and every booking attempt failed with `TRIP_IN_PAST`). `GET /trips/my` is unchanged so drivers can still complete departed trips.
- Trip edit (`PATCH /trips/:id`) rejects already-departed trips with `409 TRIP_IN_PAST`, matching the departure cutoff of booking creation/cancel and driver decisions.
- Changing a trip's departure time/duration now also checks passengers' other active bookings for overlap and rejects with `409 PASSENGER_BOOKING_OVERLAP` (same overlap semantics as booking creation) — passengers can no longer end up with two active bookings on overlapping trips.
- Manual trip completion (`PATCH /trips/:id/complete`) now notifies declined pending passengers (persistent notification + WS events), matching the auto-completion worker path.
- Seat limits are uniform: input DTOs and response schemas both cap at `MAX_SEATS = 3` (no legacy tolerance — the app is in development with no production data, so the four-seat rows the earlier migration preserved cannot occur).
- Production SPA fallback no longer swallows unknown API routes: the `index.html` catch-all excludes the `/api` prefix, so mistyped/removed API GETs return a JSON `404` instead of `200 text/html`.
- Contracts reject whitespace-only user text: `createFeedbackDtoSchema.subject/text` and `createReviewDtoSchema.text` now trim before the min-length check (Zod 4 `.trim()`), so `"   "` no longer passes validation to be persisted as an empty string.

#### Mini-app

- Drivers can review all confirmed passengers: the review-trip modal filtered a trip out after ANY review on it, hiding remaining unreviewed passengers; the filter is now per target (`tripId:target`), matching the backend's `GET /reviews/available-trips` logic.
- Trip search auto-loading stops on error: the "load more" effect and IntersectionObserver now check `isError` (sentinel unmounts, matching TripsManagePanel), eliminating an unbounded `fetchNextPage` retry loop when next-page requests fail.
- Edit-trip no longer silently mutates duration: exact `durationMinutes` is preserved on save unless the duration field was actually changed (a 90-minute trip no longer becomes 120 minutes).
- Edit-trip drafts are written to localStorage only after the first user change instead of on mount, so stale snapshots can no longer shadow newer trip data on reopen.

#### Webapp (Admin Panel)

- All admin tables format dates in the service timezone `Europe/Moscow` (shared `webapp/src/lib/format.ts` helpers), matching the backend display convention — previously timestamps rendered in the admin's browser timezone and late-evening departures could flip to the wrong calendar date.
- Users page resets pagination synchronously with the search input (Bookings/Trips pattern) instead of a post-render effect, eliminating a redundant request with the stale page on every search change.

### Audit Remediation (2026-08-21)

All findings from the full source audit are resolved: 2 High, 7 Medium, 26 Low.

#### Security

- Refresh-token rotation is atomic: revocation is a single `UPDATE ... WHERE revokedAt IS NULL` claim, so concurrent rotations of one token can no longer both succeed (TOCTOU race under Read Committed).
- Refresh-token reuse detection: presenting an already-rotated token to `/auth/refresh` revokes ALL active tokens of that user (token family revocation). A repeated `/logout` with an old token does not revoke the family.
- Auth rate limits are configurable per endpoint: `VK_AUTH_RATE_WINDOW_MS`/`VK_AUTH_RATE_MAX` (default 5 req/5 min) and `REFRESH_RATE_WINDOW_MS`/`REFRESH_RATE_MAX` (default 10 req/10 min). The previously dead `AUTH_RATE_*` variables were removed.
- Production Compose publishes the backend on `127.0.0.1:3000` only; the local dev database binds to `127.0.0.1:5433`.

#### API And Contracts

- `GET /trips` rejects non-positive `maxPrice` with `400` (contract requires a positive integer).
- `PATCH /bookings/:id/status` maps unique-index conflicts (`P2002`) to `409`, matching `POST /bookings`.
- WebSocket contract matches the implementation: server sends `auth:ok`, `ping` (keep-alive), and business events; client sends only `auth` and `pong`. Dead server `pong`/`error` events, unused `wsPingSchema`, and a client `ping` variant were removed.
- `authRequestSchema` accepts only `searchParams`; dead `vkUserId`/`sign`/`ts` fields were removed.
- `tripFiltersDtoSchema` includes `q`; the frontend search filters type is now the shared contract.

#### Frontend

- Trip details invalidates `trip.id` cache keys after driver booking decisions and passenger cancellation.
- Edit-trip form computes next values outside the state updater (StrictMode-safe).
- Departure-time pickers rely on Moscow-time validation instead of device-timezone `disablePast`.
- Query retry policy retries request timeouts (408) and never retries deterministic response-validation failures.
- The HTTP client honors caller signals that are already aborted before dispatch.
- Snackbar dedupe map evicts expired entries; WS events invalidate public trip lists; corrupted localStorage drafts are discarded via shape validation; all path-interpolated API ids are URL-encoded.

#### Tooling And Deploy

- Unused root dependencies removed (`@google/genai`, `express`, `lucide-react`, `motion`, `react-router-dom`, `@types/express`); `vite` declared once (devDependencies).
- `npm run clean` removes actual workspace build outputs.
- Docker image runs `node:22-alpine`, matching CI Node 22; `engines` requires Node >= 22.
- Stale `bun.lock` removed and gitignored; npm/`package-lock.json` is canonical.
- Graceful shutdown closes idle keep-alive connections; access log and request metrics include errored requests.
- Prisma schema drops the explicit review-unique index name, eliminating schema/migration drift.
- `metadata.json` identity fields filled; bogus Gemini capability removed.

### Security And Integrity Hardening

- VK authentication verifies the complete signed launch parameter string and does not trust unsigned profile fields or derive `isVerified` from browser input.
- Public profiles omit license plates; public trip responses mask exact pickup and destination addresses.
- VK community messages use `POST /messages.send`; the community token is not placed in the request URL.
- Driver booking decisions are rate-limited and restricted to `pending -> confirmed|declined` before departure. No-op decisions do not create duplicate notifications.
- Review authorization is directional: passenger -> driver or driver -> confirmed passenger.
- Trip auto-completion atomically claims active trips, and seat resizing revalidates occupied seat numbers inside the serializable transaction.
- Notification cursors validate UUID/date payloads and reject invalid fractional limits.
- Frontend API response validation fails closed on schema drift; login and refresh responses use `authResponseSchema`.
- WebSocket cleanup prevents reconnects after unmount and ignores stale socket callbacks. VK visibility and swipe-back lifecycle handling is synchronized and cleaned up.

### API And Database

- `POST /bookings` returns `200` for an idempotent retry by the same passenger and seat, `409 SEAT_TAKEN` for another passenger, and `409 ALREADY_BOOKED` for another seat held by the same passenger.
- Partial unique indexes `active_seat_booking` and `active_passenger_booking` protect active bookings from races.
- `GET /reviews/user/:userId` and `GET /bookings/trip/:tripId` use cursor pagination with `limit` and `cursor` validation.
- Legacy trips are normalized to the four-seat maximum; active out-of-range bookings are declined during migration.
- Trip worker processing is batched with keyset pagination and atomic active-trip claiming.

### Historical Notes

- API robustness includes idempotent booking retries, partial unique booking indexes, and Serializable conflict handling.
- Cursor-based pagination is used for public user reviews and driver booking requests.
- Trip worker processing uses bounded batches, keyset pagination, selective reads, and `Promise.allSettled` for side effects.
- Sentry helpers strip PII, VK launch timestamp drift is observable, and the WebSocket reaper has idempotent shutdown and zombie-tick protection.
- CI checks contracts, Prisma validation, typechecking, build, tests, and untracked build artifacts.

### Observability And Tooling

- Sentry initialization is centralized with PII stripping for users, request data, and sensitive extra fields.
- VK launch timestamp drift over one minute is logged and reported for diagnostics; timestamps older than five minutes are rejected.
- WebSocket reaper shutdown is idempotent and ignores queued zombie ticks.
- CI verifies contracts, Prisma, typechecking, build, tests, and that build artifacts are not tracked.

### Verification

- `npm run typecheck` passed for all workspaces.
- 164 tests passed: 34 frontend, 28 contracts, 102 backend (including the new refresh-rotation integration suite).
- `npm run lint`, `npm run format:check`, and `npm run bundle:check` passed.
- `npm run build` passed; the Docker image builds on `node:22-alpine`.

### Breaking Changes

- `POST /bookings` idempotent retries now return `200` with the existing booking instead of `409`.
- `GET /reviews/user/:userId` and `GET /bookings/trip/:tripId` return `{ items, pagination }` instead of a bare array.
