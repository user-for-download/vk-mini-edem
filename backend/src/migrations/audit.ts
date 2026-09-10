// backend/src/migrations/audit.ts
// Durable audit trail миграционных прогонов (tg-migration-23).
//
// Формат — JSONL (одна запись на строку): читается человеком и машиной,
// дописывается без перезаписи файла, переживает рестарт процесса.
// Путь по умолчанию — рядом с модулем; тесты и раннеры передают свой.
// Запись не валидирует политику (это дело engine) — только фиксирует факт.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_AUDIT_PATH = path.resolve(
  __dirname,
  "../../logs/migration-audit.jsonl",
);

export interface MigrationAuditEntry {
  /** ISO-timestamp записи. */
  at: string;
  /** Тип прогона: dry-run | apply | rollback. */
  kind: "dry-run" | "apply" | "rollback";
  /** Итог engine: report | refused | no_action_required | restored. */
  action: string;
  /** Записей в БД сделано. */
  writes: number;
  /** Сводка плана (total/independent/conflict/blocked/unsupported). */
  summary: Record<string, number>;
  /** Человекочитаемая деталь engine. */
  detail: string;
  /** Кто/что запустило (CLI, runbook-шаг, имя оператора). */
  actor: string;
}

/** Дописывает запись в JSONL-журнал (создаёт каталог при необходимости). */
export function recordMigrationRun(
  entry: MigrationAuditEntry,
  auditPath: string = DEFAULT_AUDIT_PATH,
): string {
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, "utf-8");
  return auditPath;
}

/** Читает весь журнал (пропускает битые строки, не падает). */
export function readMigrationAudit(
  auditPath: string = DEFAULT_AUDIT_PATH,
): MigrationAuditEntry[] {
  if (!fs.existsSync(auditPath)) return [];
  const entries: MigrationAuditEntry[] = [];
  for (const line of fs.readFileSync(auditPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as MigrationAuditEntry);
    } catch {
      continue;
    }
  }
  return entries;
}
