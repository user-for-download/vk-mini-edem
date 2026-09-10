// backend/tests/unit/migrationAudit.test.ts
// tg-migration-23: audit trail дописывается и читается, битые строки
// не роняют чтение, отсутствие файла — пустой журнал.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readMigrationAudit,
  recordMigrationRun,
  type MigrationAuditEntry,
} from "../../src/migrations/audit.js";

function entry(overrides: Partial<MigrationAuditEntry> = {}): MigrationAuditEntry {
  return {
    at: new Date().toISOString(),
    kind: "dry-run",
    action: "report",
    writes: 0,
    summary: { total: 0 },
    detail: "no migration required (no production dataset)",
    actor: "test",
    ...overrides,
  };
}

describe("migration audit trail", () => {
  it("append + read roundtrip", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mig-audit-"));
    const file = path.join(dir, "audit.jsonl");

    recordMigrationRun(entry({ detail: "first" }), file);
    recordMigrationRun(entry({ detail: "second", kind: "rollback" }), file);

    const read = readMigrationAudit(file);
    expect(read).toHaveLength(2);
    expect(read[0].detail).toBe("first");
    expect(read[1].kind).toBe("rollback");
    expect(read.every((e) => e.writes === 0)).toBe(true);
  });

  it("missing file → empty journal", () => {
    expect(
      readMigrationAudit(path.join(os.tmpdir(), "mig-audit-nope.jsonl")),
    ).toEqual([]);
  });

  it("corrupt lines are skipped", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mig-audit-"));
    const file = path.join(dir, "audit.jsonl");
    fs.writeFileSync(file, 'not-json\n{"at":"x"}\n', "utf-8");

    const read = readMigrationAudit(file);
    expect(read).toHaveLength(1);
  });
});
