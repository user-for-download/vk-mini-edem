const DRAFT_PREFIX = "edem:draft:";

export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
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
