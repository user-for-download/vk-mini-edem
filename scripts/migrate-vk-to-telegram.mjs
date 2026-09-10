// scripts/migrate-vk-to-telegram.mjs — VK → Telegram account migration command.
// Стабильная точка входа runbook (docs/migration/account-migration-runbook.md):
// проксирует backend/src/migrations/runner.ts через tsx с пробросом env/аргументов.
//
//   node scripts/migrate-vk-to-telegram.mjs [--dry-run]
//   node scripts/migrate-vk-to-telegram.mjs --apply --approve-product --approve-legal --approve-operations
//
// Дефолт — dry-run: отчёт без записей. Write без трёх аппрувов отказывает
// (exit 2). DATABASE_URL обязателен (как scripts/backup.sh в backend/scripts).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

if (!process.env.DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL is not set. Refusing to run migration without an explicit database target.",
  );
  process.exit(1);
}

try {
  execFileSync(
    "npx",
    ["tsx", "src/migrations/runner.ts", ...process.argv.slice(2)],
    { cwd: path.join(repoRoot, "backend"), stdio: "inherit" },
  );
} catch (e) {
  process.exit(e.status ?? 1);
}
