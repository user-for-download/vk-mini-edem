// backend/src/migrations/telegramAccountMigration.ts
//
// Движок инвентаризации/миграции аккаунтов VK → Telegram (tg-migration-19).
//
// Политика (docs/migration/account-migration-policy.md): production-данных
// нет, поэтому корректный исход — dry-run отчёт «migrate нечего» без записей
// и без авто-линкинга. Любая запись требует трёх аппрувов (Product, Legal,
// Operations); без них execute отказывает, а не пишет частично.
//
// Модуль чистый (вход — снапшоты, выход — план/отчёт), загрузка снапшотов
// из БД — в runner.ts. Детерминирован: повторный прогон по тем же данным
// даёт тот же план (идемпотентность рерана).
import { db } from "../db.js";

export type SourcePlatform = "vk" | "telegram" | "unknown";

export interface ObligationCounts {
  /** Активные поездки водителя (status = active). */
  activeTrips: number;
  /** Брони passenger в pending/confirmed на активных поездках. */
  activeBookings: number;
  /** Активные запросы попутчика (status = active). */
  activeRideRequests: number;
}

export interface SourceUserSnapshot {
  id: string;
  platform: SourcePlatform;
  bannedAt: Date | null;
  deletedAt: Date | null;
  obligations: ObligationCounts;
  /** Прочие owned-данные (не обязательства): отзывы, репорты, обращения. */
  ownedRecords: number;
}

/**
 * Вердикт по политике:
 * - independent — отдельный TG-аккаунт, линка нет (дефолт без аппрувов);
 * - conflict_obligations — активные обязательства, трогать нельзя;
 * - blocked_banned / blocked_deleted — терминальные состояния источника;
 * - unsupported — источник без идентификатора платформы / мусор.
 */
export type MigrationVerdict =
  | "independent"
  | "conflict_obligations"
  | "blocked_banned"
  | "blocked_deleted"
  | "unsupported";

export interface PlanEntry {
  userId: string;
  platform: SourcePlatform;
  verdict: MigrationVerdict;
  reason: string;
}

export interface MigrationSummary {
  total: number;
  independent: number;
  conflict: number;
  blocked: number;
  unsupported: number;
}

export interface MigrationPlan {
  entries: PlanEntry[];
  summary: MigrationSummary;
}

/** Чистая классификация одного источника по таблице политики. */
export function classifySourceUser(user: SourceUserSnapshot): PlanEntry {
  const base = { userId: user.id, platform: user.platform };
  if (user.platform === "unknown") {
    return {
      ...base,
      verdict: "unsupported",
      reason: "no platform identity (no telegramUserId)",
    };
  }
  if (user.bannedAt !== null) {
    return {
      ...base,
      verdict: "blocked_banned",
      reason: "source is banned; restriction preserved, appeal first",
    };
  }
  if (user.deletedAt !== null) {
    return {
      ...base,
      verdict: "blocked_deleted",
      reason: "source tombstoned; terminal state, no resurrection",
    };
  }
  const { activeTrips, activeBookings, activeRideRequests } = user.obligations;
  if (activeTrips + activeBookings + activeRideRequests > 0) {
    return {
      ...base,
      verdict: "conflict_obligations",
      reason:
        `active obligations (trips=${activeTrips}, bookings=${activeBookings}, ` +
        `rideRequests=${activeRideRequests}); manual review, no orphaning`,
    };
  }
  return {
    ...base,
    verdict: "independent",
    reason: "no approved source mapping; independent Telegram account, no link",
  };
}

/** Чистый построитель плана. Сортировка по userId — детерминизм рерана. */
export function buildMigrationPlan(users: SourceUserSnapshot[]): MigrationPlan {
  const entries = [...users]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(classifySourceUser);
  const summary: MigrationSummary = {
    total: entries.length,
    independent: 0,
    conflict: 0,
    blocked: 0,
    unsupported: 0,
  };
  for (const entry of entries) {
    switch (entry.verdict) {
      case "independent":
        summary.independent += 1;
        break;
      case "conflict_obligations":
        summary.conflict += 1;
        break;
      case "blocked_banned":
      case "blocked_deleted":
        summary.blocked += 1;
        break;
      case "unsupported":
        summary.unsupported += 1;
        break;
    }
  }
  return { entries, summary };
}

export interface MigrationApprovals {
  product: boolean;
  legal: boolean;
  operations: boolean;
}

export type ExecutionAction = "report" | "refused" | "no_action_required";

export interface ExecutionResult {
  action: ExecutionAction;
  /** Записей в БД сделано (инвариант текущей политики: всегда 0). */
  writes: number;
  summary: MigrationSummary;
  detail: string;
}

/**
 * Выполнение плана. Пишет в БД ровно ничего (linking flow не построен —
 * отдельный продуктовый этап): dry-run возвращает отчёт, write без трёх
 * аппрувов — отказ с перечислением недостающих.
 */
export function executeMigrationPlan(
  plan: MigrationPlan,
  options: { dryRun?: boolean; approvals?: MigrationApprovals } = {},
): ExecutionResult {
  const dryRun = options.dryRun ?? true;
  if (dryRun) {
    return {
      action: "report",
      writes: 0,
      summary: plan.summary,
      detail:
        plan.summary.total === 0
          ? "no migration required (no production dataset)"
          : `dry-run: ${plan.summary.independent} independent, ` +
            `${plan.summary.conflict} conflict, ${plan.summary.blocked} blocked, ` +
            `${plan.summary.unsupported} unsupported; no writes performed`,
    };
  }
  const approvals = options.approvals ?? {
    product: false,
    legal: false,
    operations: false,
  };
  const missing = (Object.entries(approvals) as Array<
    [keyof MigrationApprovals, boolean]
  >)
    .filter(([, granted]) => !granted)
    .map(([name]) => name);
  if (missing.length > 0) {
    return {
      action: "refused",
      writes: 0,
      summary: plan.summary,
      detail: `write refused without approvals: ${missing.join(", ")}`,
    };
  }
  return {
    action: "no_action_required",
    writes: 0,
    summary: plan.summary,
    detail:
      "approvals present but no link primitive exists yet; " +
      "conflict/unsupported queues await manual review, no writes performed",
  };
}

/** Текстовый отчёт прогона (формат примера из политики). */
export function renderPlanReport(plan: MigrationPlan): string {
  const s = plan.summary;
  const lines = [
    "VK → Telegram account migration plan (dry-run)",
    `total: ${s.total}`,
    `independent: ${s.independent}`,
    `conflict: ${s.conflict}`,
    `blocked: ${s.blocked}`,
    `unsupported: ${s.unsupported}`,
  ];
  for (const entry of plan.entries) {
    if (entry.verdict !== "independent") {
      lines.push(`- ${entry.userId} [${entry.platform}]: ${entry.verdict} — ${entry.reason}`);
    }
  }
  if (s.total === 0) {
    lines.push("action: no migration required (no production dataset)");
  }
  return lines.join("\n");
}

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

/**
 * Загрузка инвентаря из БД: все пользователи + обязательства.
 * Один пользователь — одна строка users + три дешёвых count-запроса.
 */
export async function loadMigrationInventory(): Promise<SourceUserSnapshot[]> {
  const users = await db.user.findMany({
    select: {
      id: true,
      telegramUserId: true,
      bannedAt: true,
      deletedAt: true,
      _count: {
        select: {
          reviewsGiven: true,
          reviewsRecv: true,
          reportsMade: true,
          feedbacks: true,
          notifications: true,
        },
      },
    },
  });
  return Promise.all(
    users.map(async (user) => {
      // VK-колонка удалена (tg-migration-26): платформа либо telegram,
      // либо unknown (запись без идентификатора — unsupported).
      const platform: SourcePlatform =
        user.telegramUserId !== null ? "telegram" : "unknown";
      const [activeTrips, activeBookings, activeRideRequests] = await Promise.all([
        db.trip.count({ where: { driverId: user.id, status: "active" } }),
        db.booking.count({
          where: {
            passengerId: user.id,
            status: { in: ACTIVE_BOOKING_STATUSES },
            trip: { status: "active" },
          },
        }),
        db.rideRequest.count({ where: { userId: user.id, status: "active" } }),
      ]);
      return {
        id: user.id,
        platform,
        bannedAt: user.bannedAt,
        deletedAt: user.deletedAt,
        obligations: { activeTrips, activeBookings, activeRideRequests },
        ownedRecords:
          user._count.reviewsGiven +
          user._count.reviewsRecv +
          user._count.reportsMade +
          user._count.feedbacks +
          user._count.notifications,
      };
    }),
  );
}
