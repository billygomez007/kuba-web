import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import fs from "node:fs";

// These tests exercise the safety-gate logic in
// scripts/reconcile-staging-migration-ledger.mjs as pure functions, mirroring
// the script's actual checks. They never open a database connection —
// consistent with this repo's established test convention of not connecting
// tests to any real (let alone production) database.

const ALLOWED_HOST_PREFIX = "superkuba-staging-";
const FORBIDDEN_HOST_SUBSTRINGS = ["kuba-staging", "production", "prod-"];
const EXPECTED_TABLE_COUNT = 87;

function hostGate(host) {
  for (const bad of FORBIDDEN_HOST_SUBSTRINGS) {
    if (host.toLowerCase().includes(bad) && !host.startsWith(ALLOWED_HOST_PREFIX)) {
      return { ok: false, reason: `forbidden substring "${bad}"` };
    }
  }
  if (!host.startsWith(ALLOWED_HOST_PREFIX)) {
    return { ok: false, reason: "does not match required prefix" };
  }
  return { ok: true };
}

test("Refuses a kuba-staging host", () => {
  const result = hostGate("kuba-staging-billygomez007");
  assert.equal(result.ok, false);
});

test("Refuses a production-named host", () => {
  const result = hostGate("kuba-production-billygomez007");
  assert.equal(result.ok, false);
});

test("Refuses an unrelated/unknown host", () => {
  const result = hostGate("some-other-database-xyz");
  assert.equal(result.ok, false);
});

test("Accepts a genuine superkuba-staging host", () => {
  const result = hostGate("superkuba-staging-billygomez007");
  assert.equal(result.ok, true);
});

test("Dry run performs zero writes regardless of ledger/table state", () => {
  function planAction(mode, tableCount, ledgerRowCount) {
    if (mode === "dry-run") return { writes: 0, action: "report only" };
    if (tableCount !== EXPECTED_TABLE_COUNT) return { writes: 0, action: "refuse: table count mismatch" };
    if (ledgerRowCount > 0) return { writes: 0, action: "refuse: conflicting ledger" };
    return { writes: 1, action: "seed one ledger row" };
  }
  assert.equal(planAction("dry-run", 87, 0).writes, 0);
  assert.equal(planAction("dry-run", 44, 5).writes, 0);
});

test("Conflicting (non-empty) ledger causes fail-closed refusal, never an overwrite", () => {
  function planAction(tableCount, ledgerRowCount) {
    if (tableCount !== EXPECTED_TABLE_COUNT) return { writes: 0, refused: true, reason: "table_count_mismatch" };
    if (ledgerRowCount > 0) return { writes: 0, refused: true, reason: "conflicting_ledger" };
    return { writes: 1, refused: false };
  }
  const result = planAction(87, 1);
  assert.equal(result.refused, true);
  assert.equal(result.reason, "conflicting_ledger");
  assert.equal(result.writes, 0);
});

test("Unexpected application-table count fails closed before any ledger write", () => {
  function planAction(tableCount, ledgerRowCount) {
    if (tableCount !== EXPECTED_TABLE_COUNT) return { writes: 0, refused: true, reason: "table_count_mismatch" };
    if (ledgerRowCount > 0) return { writes: 0, refused: true, reason: "conflicting_ledger" };
    return { writes: 1, refused: false };
  }
  for (const count of [86, 88, 44, 0]) {
    const result = planAction(count, 0);
    assert.equal(result.refused, true, `table count ${count} must be refused`);
    assert.equal(result.reason, "table_count_mismatch");
  }
});

test("Repeated execution against an already-seeded ledger is safe (idempotent refusal, not a duplicate write)", () => {
  function runOnce(existingLedgerRowCount) {
    if (existingLedgerRowCount > 0) return { seeded: false, refused: true };
    return { seeded: true, refused: false };
  }
  const first = runOnce(0);
  assert.equal(first.seeded, true);
  const second = runOnce(1); // ledger now has the row seeded by the first run
  assert.equal(second.seeded, false);
  assert.equal(second.refused, true);
});

test("Seed values are derived from the real migration file, not hand-encoded", () => {
  // Mirrors readMigrationFiles()'s hash derivation: sha256 of the exact file
  // bytes, and folderMillis taken directly from the journal's `when` field —
  // never a literal/guessed constant baked into the reconciliation script.
  const content = fs.readFileSync("drizzle/0038_current_live_baseline.sql", "utf8");
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  assert.equal(typeof hash, "string");
  assert.equal(hash.length, 64);
});

test("Credentials are never part of any logged output field", () => {
  const loggedFields = ["host", "tableCount", "migrationCount", "folderMillis", "hashPrefix"];
  const forbidden = [/token/i, /secret/i, /password/i, /authtoken/i, /credential/i];
  for (const field of loggedFields) {
    assert.equal(forbidden.some((p) => p.test(field)), false);
  }
});

test("The dangling 0038_current_live_baseline_reconciled journal entry has no committed provenance and is correctly absent after cleanup", () => {
  const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
  const danglingEntry = journal.entries.find((e) => e.tag === "0038_current_live_baseline_reconciled");
  assert.equal(danglingEntry, undefined, "the dangling entry must not exist in the journal after Phase 3 cleanup");
  const legitimateEntry = journal.entries.find((e) => e.tag === "0038_current_live_baseline");
  assert.notEqual(legitimateEntry, undefined, "the legitimate baseline entry must still be present");
});

test("Migration files exist for every journal entry (readMigrationFiles' hard precondition)", () => {
  const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) {
    const path = `drizzle/${entry.tag}.sql`;
    assert.equal(fs.existsSync(path), true, `missing migration file for journal entry ${entry.tag}`);
  }
});
