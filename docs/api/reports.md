# Reports API

## User endpoints

- `POST /api/v1/reports` creates a report with `targetType` (`user`, `trip` or `booking`), `targetId`, `category` and `description`.
- `GET /api/v1/reports` returns only reports created by the authenticated user.

Categories are `safety`, `fraud`, `harassment`, `spam`, `inaccurate_info` and `other`.

Reports require a relevant driver/passenger relationship. Self-reports and unrelated targets are rejected. Open duplicate reports for the same reporter, target and category return `409`. Mutations are sanitized and rate-limited.

## Admin endpoints

- `GET /api/v1/admin/reports?status=&targetType=&page=&pageSize=` lists reports for an authenticated admin session.
- `GET /api/v1/admin/reports/:id` returns one report.
- `PATCH /api/v1/admin/reports/:id/status` changes status to `in_review`, `resolved` or `rejected`, optionally with `resolutionNote`.

The state machine is `pending -> in_review -> resolved|rejected`. Terminal reports cannot be changed. Admin actions record `adminActorType: "admin"` and a resolution timestamp.

Open reports are protected by a database partial unique index for reporter, target and category. Concurrent duplicates return `409`. Admin status writes are conditional on a non-terminal current status and concurrent transitions return `409`.
