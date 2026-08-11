// backend/src/trips/errors.ts
// Ошибки бизнес-логики поездок. TripError прокидывается из транзакций
// (где нельзя просто вернуть c.json) и ловится в роутере, превращаясь
// в JSON-ответ с корректным code/status.
import { ERROR_CODES } from "../errors.js";

export interface TripErrorKind {
  code: string;
  status: number;
}

export const TripErrors = {
  notFound: (): TripErrorKind => ({ code: ERROR_CODES.NOT_FOUND, status: 404 }),
  forbidden: (): TripErrorKind => ({ code: ERROR_CODES.FORBIDDEN, status: 403 }),
  notActive: (): TripErrorKind => ({ code: ERROR_CODES.TRIP_NOT_ACTIVE, status: 400 }),
  notStarted: (): TripErrorKind => ({ code: ERROR_CODES.TRIP_IN_PAST, status: 400 }),
  conflict: (): TripErrorKind => ({ code: ERROR_CODES.CONFLICT, status: 409 }),
} as const;

export class TripError extends Error {
  constructor(
    readonly kind: TripErrorKind,
    message: string
  ) {
    super(message);
    this.name = "TripError";
  }

  get code(): string {
    return this.kind.code;
  }

  get status(): number {
    return this.kind.status;
  }
}
