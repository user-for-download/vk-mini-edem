const DRAFT_PREFIX = "edem:draft:";

/**
 * Читает черновик из localStorage.
 *
 * `validate` — опциональный type guard формы. Повреждённый или устаревший
 * черновик (другая версия схемы, ручная правка) вернёт null вместо
 * частично заполненного объекта, на котором рендер упал бы с
 * `undefined.length` / `undefined.trim()`.
 */
export function readDraft<T>(key: string, validate?: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (validate) {
      return validate(parsed) ? parsed : null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in restricted WebViews.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    // Ignore unavailable storage.
  }
}
