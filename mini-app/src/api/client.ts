const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

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

class ApiClient {
  private token: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setRefreshToken(token: string | null) {
    this.refreshTokenValue = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
        return retryResponse.json();
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.message || `HTTP error ${response.status}`, errorData.code, response.status);
    }

    return response.json();
  }

  private async doFetch(endpoint: string, options: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  }

  /**
   * Пытаемся обновить токен.
   * Используется паттерн «одного промиса», чтобы при нескольких
   * параллельных 401 refresh произошёл только один раз.
   */
  private async tryRefresh(): Promise<boolean> {
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

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.token = data.accessToken;
      this.refreshTokenValue = data.refreshToken;
      return true;
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
