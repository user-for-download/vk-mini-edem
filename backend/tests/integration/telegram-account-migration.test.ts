import { afterEach, describe, expect, it } from "vitest";

const {
  buildMigrationPlan,
  classifySourceUser,
  executeMigrationPlan,
  loadMigrationInventory,
  renderPlanReport,
} = await import("../../src/migrations/telegramAccountMigration.js");
const { db } = await import("../../src/db.js");

/**
 * Миграция аккаунтов VK → Telegram (tg-migration-19).
 *
 * Production-данных нет: движок — dry-run инвентаризация без записей
 * и без авто-линкинга (политика account-migration-policy.md). Доказываем:
 * нет дублей, нет сирот-владения, линк невозможен без аппрувов (и с ними —
 * примитива нет), реран детерминирован.
 *
 * Паттерны репо: реальная БД, уникальные id (vk 9_951_000+, tg 9_950_000n+),
 * чистка в afterEach.
 */
const createdUserIds: string[] = [];
const createdTripIds: string[] = [];
let tgSeq = 9_950_000n;

function emptyObligations() {
  return { activeTrips: 0, activeBookings: 0, activeRideRequests: 0 };
}

async function seedTgUser(data: Record<string, unknown> = {}) {
  tgSeq += 1n;
  const user = await db.user.create({
    data: {
      telegramUserId: tgSeq,
      name: `TgMig-${tgSeq}`,
      avatar: "https://t.me/i/userpic/320/seed.svg",
      ...data,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

afterEach(async () => {
  await db.booking.deleteMany({
    where: { passengerId: { in: createdUserIds } },
  });
  if (createdTripIds.length > 0) {
    await db.trip.deleteMany({ where: { id: { in: createdTripIds } } });
  }
  await db.refreshToken.deleteMany({
    where: { userId: { in: createdUserIds } },
  });
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
  createdTripIds.length = 0;
});

describe("classifySourceUser — таблица политики", () => {
  it("чистый VK → independent без линка", () => {
    const entry = classifySourceUser({
      id: "u1",
      platform: "vk",
      bannedAt: null,
      deletedAt: null,
      obligations: emptyObligations(),
      ownedRecords: 3,
    });
    expect(entry.verdict).toBe("independent");
  });

  it("бан → blocked_banned, удаление → blocked_deleted", () => {
    const banned = classifySourceUser({
      id: "u1",
      platform: "vk",
      bannedAt: new Date(),
      deletedAt: null,
      obligations: emptyObligations(),
      ownedRecords: 0,
    });
    expect(banned.verdict).toBe("blocked_banned");

    const deleted = classifySourceUser({
      id: "u2",
      platform: "telegram",
      bannedAt: null,
      deletedAt: new Date(),
      obligations: emptyObligations(),
      ownedRecords: 0,
    });
    expect(deleted.verdict).toBe("blocked_deleted");
  });

  it("активные обязательства → conflict_obligations", () => {
    for (const obligations of [
      { activeTrips: 1, activeBookings: 0, activeRideRequests: 0 },
      { activeTrips: 0, activeBookings: 2, activeRideRequests: 0 },
      { activeTrips: 0, activeBookings: 0, activeRideRequests: 1 },
    ]) {
      expect(
        classifySourceUser({
          id: "u",
          platform: "vk",
          bannedAt: null,
          deletedAt: null,
          obligations,
          ownedRecords: 0,
        }).verdict,
      ).toBe("conflict_obligations");
    }
  });

  it("без идентификатора платформы → unsupported", () => {
    const entry = classifySourceUser({
      id: "u",
      platform: "unknown",
      bannedAt: null,
      deletedAt: null,
      obligations: emptyObligations(),
      ownedRecords: 0,
    });
    expect(entry.verdict).toBe("unsupported");
  });
});

describe("executeMigrationPlan — ноль записей всегда", () => {
  const plan = buildMigrationPlan([
    {
      id: "u1",
      platform: "vk",
      bannedAt: null,
      deletedAt: null,
      obligations: emptyObligations(),
      ownedRecords: 0,
    },
  ]);

  it("dry-run → report, writes=0", () => {
    const result = executeMigrationPlan(plan);
    expect(result.action).toBe("report");
    expect(result.writes).toBe(0);
  });

  it("write без аппрувов → refused с перечислением", () => {
    const result = executeMigrationPlan(plan, {
      dryRun: false,
      approvals: { product: true, legal: false, operations: false },
    });
    expect(result.action).toBe("refused");
    expect(result.writes).toBe(0);
    expect(result.detail).toContain("legal");
    expect(result.detail).toContain("operations");
  });

  it("write с аппрувами → no_action_required, записей всё равно 0", () => {
    const result = executeMigrationPlan(plan, {
      dryRun: false,
      approvals: { product: true, legal: true, operations: true },
    });
    expect(result.action).toBe("no_action_required");
    expect(result.writes).toBe(0);
  });

  it("детерминизм: повтор по тем же данным — тот же план", () => {
    const users = [
      {
        id: "u2",
        platform: "vk" as const,
        bannedAt: null,
        deletedAt: null,
        obligations: { activeTrips: 1, activeBookings: 0, activeRideRequests: 0 },
        ownedRecords: 0,
      },
      {
        id: "u1",
        platform: "telegram" as const,
        bannedAt: null,
        deletedAt: null,
        obligations: emptyObligations(),
        ownedRecords: 5,
      },
    ];
    expect(buildMigrationPlan(users)).toEqual(buildMigrationPlan(users));
    expect(renderPlanReport(buildMigrationPlan(users))).toContain("conflict: 1");
  });
});

describe("loadMigrationInventory — живые данные без мутаций", () => {
  it("активная поездка водителя → conflict; реран идентичен; записей нет", async () => {
    const driver = await seedTgUser({});
    const trip = await db.trip.create({
      data: {
        driverId: driver.id,
        fromCity: "Москва",
        fromAddress: "A",
        toCity: "Тула",
        toAddress: "B",
        departureAt: new Date("2030-06-01T09:00:00Z"),
        durationMinutes: 120,
        distanceKm: 180,
        price: 500,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: [],
      },
    });
    createdTripIds.push(trip.id);
    await seedTgUser({ bannedAt: new Date() });

    const userCountBefore = await db.user.count();
    const first = buildMigrationPlan(await loadMigrationInventory());
    const second = buildMigrationPlan(await loadMigrationInventory());
    const userCountAfter = await db.user.count();

    // Инвентаризация ничего не пишет и детерминирована.
    expect(userCountAfter).toBe(userCountBefore);
    expect(second).toEqual(first);

    const byId = new Map(first.entries.map((e) => [e.userId, e]));
    expect(byId.get(driver.id)?.verdict).toBe("conflict_obligations");
    expect(
      [...byId.values()].filter((e) => e.verdict === "blocked_banned"),
    ).toHaveLength(1);

    // TG-идентичность водителя на месте, линка никуда нет (примитива нет).
    const untouched = await db.user.findUnique({ where: { id: driver.id } });
    expect(untouched?.telegramUserId).not.toBeNull();

    const report = renderPlanReport(first);
    expect(report).toContain("conflict:");
    expect(report).toContain("blocked:");
  });
});
