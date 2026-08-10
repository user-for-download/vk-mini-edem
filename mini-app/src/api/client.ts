import type { ZodType } from "zod";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface TokenUpdate {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type TokenUpdateListener = (tokens: TokenUpdate) => void;

class ApiClient {
  private token: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshGeneration = 0;
  private tokenListeners: Set<TokenUpdateListener> = new Set();
  private sessionExpiredListeners: Set<() => void> = new Set();

  setToken(token: string | null) {
    this.token = token;
  }

  setRefreshToken(token: string | null) {
    this.refreshTokenValue = token;
  }

  getToken(): string | null {
    return this.token;
  }

  /**
   * Подписка на тихие обновления токенов (silent refresh).
   * Возвращает функцию отписки.
   */
  onTokenUpdate(listener: TokenUpdateListener): () => void {
    this.tokenListeners.add(listener);
    return () => this.tokenListeners.delete(listener);
  }

  private emitTokenUpdate(tokens: TokenUpdate) {
    this.tokenListeners.forEach((listener) => listener(tokens));
  }

  /**
   * Подписка на необратимый отказ refresh (401 от /auth/refresh):
   * токен отозван/истёк, сессию нужно сбросить, иначе приложение
   * навсегда застревает с мёртвыми токенами.
   */
  onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.add(listener);
    return () => this.sessionExpiredListeners.delete(listener);
  }

  private emitSessionExpired() {
    this.sessionExpiredListeners.forEach((listener) => listener());
  }

  /**
   * Отменяет применение результатов in-flight refresh (пользователь вышел
   * из аккаунта, пока обновление токена выполнялось).
   */
  invalidatePendingRefresh() {
    this.refreshGeneration++;
  }

  async request<T>(endpoint: string, options: RequestInit = {}, schema?: ZodType<T>): Promise<T> {
    const response = await this.doFetch(endpoint, options);

    // Если 401 и это НЕ сам auth-эндпоинт — пробуем refresh
    if (
      response.status === 401 &&
      !endpoint.startsWith("/auth/") &&
      this.refreshTokenValue
    ) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Повторяем исходный запрос с новым токеном
        const retryResponse = await this.doFetch(endpoint, options);
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new ApiError(errorData.message || `HTTP error ${retryResponse.status}`, errorData.code, retryResponse.status);
        }
        return this.parseResponse(retryResponse, schema);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.message || `HTTP error ${response.status}`, errorData.code, response.status);
    }

    return this.parseResponse(response, schema);
  }

  private async parseResponse<T>(response: Response, schema?: ZodType<T>): Promise<T> {
    const data = await response.json();

    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        // Graceful degradation: при дрейфе схемы не роняем запрос.
        // В dev — подробности в консоль, в prod — предупреждение.
        if (import.meta.env.DEV) {
          console.error("[ApiClient] Zod validation failed:", parsed.error, "Data:", data);
        } else {
          console.warn("[ApiClient] Zod validation failed:", parsed.error.issues[0]?.message);
        }
        return data as T;
      }
      return parsed.data;
    }

    return data as T;
  }

  private async doFetch(endpoint: string, options: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      return await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("Таймаут запроса", "REQUEST_TIMEOUT", 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Пытаемся обновить токен.
   * Используется паттерн «одного промиса», чтобы при нескольких
   * параллельных 401 refresh произошёл только один раз.
   * Публичный — вызывается из WsProvider при закрытии соединения с кодом 1008/4401.
   */
  async tryRefresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh();
    }

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<boolean> {
    if (!this.refreshTokenValue) {
      return false;
    }

    const generationAtStart = this.refreshGeneration;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // 401 — refresh-токен отозван или истёк безвозвратно:
          // уведомляем подписчиков, чтобы сбросить сессию.
          if (response.status === 401) {
            this.emitSessionExpired();
          }
          return false;
        }

        const data = await response.json();

        // Сессия была очищена, пока шёл запрос (invalidatePendingRefresh) —
        // не применяем токены и не воскрешаем сессию.
        if (this.refreshGeneration !== generationAtStart) {
          return false;
        }

        this.token = data.accessToken;
        this.refreshTokenValue = data.refreshToken;

        // Уведомляем подписчиков (Zustand-стор), чтобы сессия не рассинхронизировалась.
        this.emitTokenUpdate(data);
        return true;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
