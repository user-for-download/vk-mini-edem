// backend/prisma/seed-ids.ts
//
// Детерминированные UUID v5 (RFC 4122, SHA-1) для сид-сущностей.
//
// Зачем: сид обязан уважать публичные контракты. Ряд Zod-схем требует id
// строго в формате UUID (createTripDtoSchema.fromCityId/toCityId,
// rideRequestSchema.id, reportSchema.id — мини-апп и админка ВАЛИДИРУЮТ
// ответы этими схемами). Slug-id вида `city-вологда`/`rr-1`/`rep-1`
// ломают и запись (POST /trips → 400 "Invalid payload" на свежезасеянной
// БД — красный E2E в CI), и чтение (списки заявок/жалоб не проходят
// валидацию на клиенте).
//
// v5 даёт одновременно детерминизм (то же имя → тот же id на каждом
// прогоне сида, ретраи/повторы не плодят дубли) и валидный UUID-формат
// для всех Zod-схем. Сущности, чьи контракты принимают plain string
// (поездки `t-*`, брони, пользователи `u-*`, отзывы `r-*`), намеренно
// оставляем читаемыми slug-id — менять их нет причин.
import { createHash } from "node:crypto";

/** Фиксированный namespace для всех сид-UUID (RFC 4122, DNS namespace). */
const SEED_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * Детерминированный UUID v5 по паре (scope, name).
 * Чистая функция: одинаковый вход — одинаковый выход, без рандома и часов.
 */
export function seedUuid(scope: string, name: string): string {
  const namespace = Buffer.from(SEED_UUID_NAMESPACE.replace(/-/g, ""), "hex");
  const digest = createHash("sha1")
    .update(namespace)
    .update(`${scope}:${name}`, "utf8")
    .digest()
    .subarray(0, 16);
  const bytes = Buffer.from(digest);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString("hex");
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  );
}

/** Детерминированный id справочника для нормализованного имени города. */
export function seedCityId(nameNormalized: string): string {
  return seedUuid("edem.city", nameNormalized);
}

/** Детерминированный id сид-заявки на поездку (читаемый ref вида `rr-1`). */
export function seedRideRequestId(ref: string): string {
  return seedUuid("edem.ride-request", ref);
}

/** Детерминированный id сид-жалобы (читаемый ref вида `rep-1`). */
export function seedReportId(ref: string): string {
  return seedUuid("edem.report", ref);
}
