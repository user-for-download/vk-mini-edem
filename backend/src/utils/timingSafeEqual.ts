// backend/src/utils/timingSafeEqual.ts
// Constant-time сравнение секретов (токенов).
// sha256-дайджесты нормализуют длину, т.к. timingSafeEqual требует
// буферы одинакового размера; сравнение не утекает по времени.
import { createHash, timingSafeEqual } from "node:crypto";

export function tokensEqual(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}
