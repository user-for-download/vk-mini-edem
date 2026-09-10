// scripts/rollback-telegram-migration.mjs — откат миграции TG (tg-migration-21).
// Восстанавливает БД из проверенного pg_dump-снапшота (backend/scripts/backup.sh),
// сверяет счётчики с манифестом и опционально гоняет smoke.
//
//   node scripts/rollback-telegram-migration.mjs --dump /backups/postgres/edem_X.dump [--execute] [--manifest manifest.json] [--smoke]
//
// Дефолт — dry-run: только план и сверка снапшота, никаких записей.
// --execute выполняет restore. DATABASE_URL обязателен (цель восстановления).
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => {
  const ix = args.indexOf(name);
  if (ix === -1) return null;
  const next = args[ix + 1];
  return next && !next.startsWith("--") ? next : "1";
};
const DUMP = flag("--dump");
const EXECUTE = args.includes("--execute");
const MANIFEST = flag("--manifest");
const RUN_SMOKE = args.includes("--smoke");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Refusing without an explicit restore target.");
  process.exit(1);
}
if (!DUMP) {
  console.error("ERROR: --dump /path/to/edem_X.dump is required.");
  process.exit(1);
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf-8", ...opts }).trim();
}

function counts() {
  // Только агрегаты для сверки — никаких персональных данных в отчёт.
  const q = (table) => `SELECT COUNT(*) FROM "${table}"`;
  const out = {};
  for (const table of ["User", "Trip", "Booking", "Notification", "Review", "Feedback"]) {
    out[table.toLowerCase()] = Number(sh(`psql "${DATABASE_URL}" -tAc '${q(table)}'`));
  }
  return out;
}

// 1. Снапшот существует, непуст и валиден (как backup.sh — verify before prune).
const stat = fs.statSync(DUMP, { throwIfNoEntry: false });
if (!stat || stat.size === 0) {
  console.error(`ERROR: dump missing or empty: ${DUMP}`);
  process.exit(1);
}
try {
  sh(`pg_restore --list "${DUMP}" > /dev/null`);
} catch {
  console.error(`ERROR: dump is not a valid pg archive: ${DUMP}`);
  process.exit(1);
}
console.log(`dump ok: ${DUMP} (${stat.size} bytes, valid archive)`);

const before = counts();
console.log(`target counts before: ${JSON.stringify(before)}`);

if (MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));
  console.log(`manifest expected: ${JSON.stringify(manifest)}`);
}

if (!EXECUTE) {
  console.log("dry-run: restore NOT executed (pass --execute to perform).");
  process.exit(0);
}

// 2. Restore поверх цели (clean: объекты снапшота пересоздаются).
console.log(`restoring ${DUMP} into target...`);
execFileSync("pg_restore", ["--clean", "--if-exists", "-d", DATABASE_URL, DUMP], {
  stdio: "inherit",
});

const after = counts();
console.log(`target counts after: ${JSON.stringify(after)}`);

// 3. Сверка с манифестом (если задан).
if (MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));
  const mismatches = Object.entries(manifest)
    .filter(([table, expected]) => after[table] !== expected)
    .map(([table, expected]) => `${table}: expected ${expected}, got ${after[table]}`);
  if (mismatches.length > 0) {
    console.error(`⛔ Reconciliation failed:\n- ${mismatches.join("\n- ")}`);
    process.exit(2);
  }
  console.log("reconciliation ok: counts match manifest.");
}

// 4. Smoke backend после отката.
if (RUN_SMOKE) {
  execFileSync("node", ["scripts/smoke-telegram-deployment.mjs"], { stdio: "inherit" });
}

console.log("✅ Rollback complete: snapshot restored, counts reported above.");
