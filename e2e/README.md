# E2E Tests

Full-cycle E2E tests for the Edem VK Mini App using Playwright + Chromium.

## Prerequisites

- Frontend running on `http://localhost:3010`
- Backend running on `http://localhost:3011`
- Dev DB running (docker container `vk-mini-edem-db-dev`)
- `ALLOW_DEV_AUTH=true` in backend `.env`

## Running

```bash
node e2e/full-cycle.mjs
```

## Test Flow

1. Driver auth (dev-sign) + home screen
2. Search accordion collapsed by default
3. Driver creates trip (Moscow→SPb, 777₽, 3 seats, tag)
4. Trip visible in "My trips"
5. Passenger auth + search screen
6. Passenger finds the trip
7. Trip details: tags without Card frame + no duplicate status
8. Passenger books a seat
9. Passenger sees "Application sent" status
10. Driver confirms booking
11. Passenger sees snackbar "Your application is confirmed!"
12. Passenger sees "Seat booked" status
13. Driver completes trip (departureTime in past)
14. Passenger leaves review (5★ + comment)
15. Mini-app: `/profile/notifications` → VK push notifications block (banner «Включить» or «Включены»)

## Artifacts

- Screenshots: `e2e/shots/`
- Results: `e2e/results.json`
