// backend/src/migrations/runner.ts
// Точка входа миграции VK → Telegram (tg-migration-19).
// Запуск: npx tsx src/migrations/runner.ts [--dry-run] [--apply
//   --approve-product --approve-legal --approve-operations]
// или стабильный алиас scripts/migrate-vk-to-telegram.mjs.
//
// Дефолт — dry-run (только отчёт, ноль записей). --apply без трёх флагов
// аппрувов отказывает; с флагами — тоже ноль записей (link primitive не
// построен, см. политику): команда фиксирует очередь ручного ревью.
import {
  buildMigrationPlan,
  executeMigrationPlan,
  loadMigrationInventory,
  renderPlanReport,
  type MigrationApprovals,
} from "./telegramAccountMigration.js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

const approvals: MigrationApprovals = {
  product: args.has("--approve-product"),
  legal: args.has("--approve-legal"),
  operations: args.has("--approve-operations"),
};

const inventory = await loadMigrationInventory();
const plan = buildMigrationPlan(inventory);
console.log(renderPlanReport(plan));

const result = executeMigrationPlan(plan, { dryRun: !apply, approvals });
console.log(`\nexecute: action=${result.action} writes=${result.writes}`);
console.log(result.detail);

if (result.action === "refused") {
  process.exitCode = 2;
}
