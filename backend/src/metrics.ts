// backend/src/metrics.ts
// Минимальные внутренние метрики в Prometheus text-формате (GET /metrics).
// Без внешних зависимостей: только счётчики/gauges, которые реально
// используются сервисом.

class Counter {
  private value = 0;

  constructor(
    private readonly name: string,
    private readonly help: string
  ) {}

  inc(by = 1): void {
    this.value += by;
  }

  get(): number {
    return this.value;
  }

  render(): string {
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
      `${this.name} ${this.value}`,
    ].join("\n");
  }
}

class Gauge {
  private value = 0;

  constructor(
    private readonly name: string,
    private readonly help: string
  ) {}

  inc(by = 1): void {
    this.value += by;
  }

  dec(by = 1): void {
    this.value -= by;
  }

  set(value: number): void {
    this.value = value;
  }

  get(): number {
    return this.value;
  }

  render(): string {
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
      `${this.name} ${this.value}`,
    ].join("\n");
  }
}

/** Сколько раз пользователю отказано в WS-подключении из-за лимита соединений. */
export const wsConnectionLimitHits = new Counter(
  "ws_connection_limit_hits_total",
  "Number of WebSocket connections rejected because the per-user limit was reached."
);

/** Текущее число открытых WS-соединений. */
export const wsConnections = new Gauge(
  "ws_connections",
  "Current number of open WebSocket connections."
);

/** Число авторизованных WS-пользователей (уникальные userId). */
export const wsAuthenticatedUsers = new Gauge(
  "ws_authenticated_users",
  "Current number of users with at least one authenticated WebSocket connection."
);

/** Все HTTP-запросы по (method, status). */
export const httpRequestsTotal = new Counter(
  "http_requests_total",
  "Total number of HTTP requests processed."
);

const METRICS: Array<{ render(): string }> = [
  httpRequestsTotal,
  wsConnectionLimitHits,
  wsConnections,
  wsAuthenticatedUsers,
];

/** Полный снимок метрик в Prometheus text-формате. */
export function metricsSnapshot(): string {
  return METRICS.map((metric) => metric.render()).join("\n") + "\n";
}
