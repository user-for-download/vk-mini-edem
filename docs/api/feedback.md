# Feedback API

Обращения пользователей в поддержку. Префикс `/api/v1/feedback`.
Источник истины по коду: `backend/src/feedback/index.ts` и
`packages/contracts/src/dto/feedback.dto.ts`. Список обращений читает
админ-панель (`GET /api/v1/admin/feedback`), админ отвечает на них
(`POST`/`PUT /api/v1/admin/feedback/:id/reply`); пользователь видит свои
обращения с ответами через `GET /api/v1/feedback`. Подробности —
`docs/api/admin.md`.

## Авторизация

Два режима:

- `POST /api/v1/feedback` — обычный пользовательский endpoint, нужен
  access-токен (`requireUser`).
- `POST /api/v1/feedback/appeal` — **публичный** канал для забаненных
  пользователей: токена у них нет (логин отклоняется 403), поэтому личность
  подтверждается подписью VK launch-параметров — той же проверкой, что и в
  `/auth/vk` (`verifyVkLaunchSignature`). Токены при этом **не выдаются**.

### POST /api/v1/feedback

Обращение авторизованного пользователя (Профиль → Помощь и поддержка →
«Обратная связь»). Rate-limit: общий `mutationLimiter`.

Тело (`createFeedbackDtoSchema`):

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `subject` | string | trim, 1–100 (`FEEDBACK_SUBJECT_MAX_LENGTH`) |
| `text` | string | trim, 1–2000 (`FEEDBACK_TEXT_MAX_LENGTH`) |

Ответы:

- `201 { id, createdAt }` — обращение создано.
- `400 { code: "VALIDATION_FAILED", message, issues }` — невалидное тело.
- `401` — нет/невалиден access-токен; `403` — пользователь забанен.

### GET /api/v1/feedback

Список собственных обращений текущего пользователя (Профиль → Помощь →
«Мои обращения»). `requireUser`. Возвращает bare array (без пагинации),
новые первыми.

Элемент (`UserFeedbackDto`): `id, subject, text, reply (string|null),
repliedAt (ISO|null), createdAt (ISO)`. `reply === null` — админ ещё не
ответил. Ответ создаётся админом через `POST /api/v1/admin/feedback/:id/reply`
(см. `docs/api/admin.md`).

Ответы:

- `200 [UserFeedbackDto]` — список (пустой массив, если обращений нет).
- `401` — нет/невалиден access-токен.

### POST /api/v1/feedback/appeal

Обращение **забаненного** пользователя с экрана блокировки (mini-app:
плашка «Аккаунт заблокирован» → «Обратная связь», тема предзаполняется
«Обжалование блокировки»). Публичный, без токена.

Тело (`feedbackAppealDtoSchema`):

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `searchParams` | string | trim, 1–4096 (`FEEDBACK_APPEAL_SEARCH_PARAMS_MAX_LENGTH`) — полная строка VK launch-параметров (`vk_user_id`, `sign`, `vk_ts`, …) |
| `subject` | string | trim, 1–100 |
| `text` | string | trim, 1–2000 |

Обработка:

1. Rate-limit: отдельный лимитер **5 запросов в час на IP** (защита от
   спама без авторизации).
2. Валидация тела → невалидно → `400 VALIDATION_FAILED`.
3. `verifyVkLaunchSignature(searchParams)`: подпись невалидна/просрочена
   или нет `vk_user_id` → `401 { message: "Invalid or expired signature" }`
   (без деталей, по образцу `/auth/vk`). При `ALLOW_DEV_AUTH` принимается
   `sign=dev-sign` (dev-окружение).
4. Пользователь не найден по `vk_user_id` → `404 { code: "NOT_FOUND" }`.
5. Проверки бана **нет** — апелляция это канал связи именно забаненного.
   Обращение создаётся с привязкой к `userId`.

Ответы:

- `201 { id, createdAt }` — обращение создано (видно в админке).
- `400` — невалидное тело (`VALIDATION_FAILED` + `issues`).
- `401` — невалидная/просроченная VK-подпись.
- `404` — пользователь с таким `vk_user_id` не найден.
- `429` — превышен лимит 5/час (`RATE_LIMITED` + `retryAfterMs`).
