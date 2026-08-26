/**
 * One-time reconciliation: create and seed __drizzle_migrations on
 * superkuba-staging so it correctly represents "everything through the
 * 0038_current_live_baseline migration is already applied," without ever
 * replaying 0000-0038 (which is not possible from scratch against a
 * database that already has all 87 application tables) and without ever
 * touching any application table.
 *
 * This does NOT run `drizzle-kit push` or `drizzle-kit migrate`. It uses
 * drizzle-orm's own migrator (drizzle-orm/libsql/migrator + the shared
 * drizzle-orm/migrator readMigrationFiles helper) so the hash/timestamp
 * seed values are derived exactly the way the real migrator would compute
 * them, not guessed or hand-encoded.
 *
 * Usage:
 *   node scripts/reconcile-staging-migration-ledger.mjs --dry-run
 *   node scripts/reconcile-staging-migration-ledger.mjs --apply
 *
 * Credentials are read ONLY from .env.staging.local (gitignored), never
 * from .env / .env.local, since those currently point at kuba-staging.
 */

import { config as loadDotenv } from "dotenv";
import { createClient } from "@libsql/client";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DRIZZLE_DIR = path.join(REPO_ROOT, "drizzle");
const EXPECTED_TABLE_COUNT = 87;
const ALLOWED_HOST_PREFIX = "superkuba-staging-";
const FORBIDDEN_HOST_SUBSTRINGS = ["kuba-staging", "production", "prod-"];

const args = new Set(process.argv.slice(2));
const isApply = args.has("--apply");
const isDryRun = args.has("--dry-run") || !isApply;

function fail(reason) {
  console.error(`\nREFUSING TO PROCEED: ${reason}`);
  process.exit(1);
}

console.log(`Mode: ${isApply ? "APPLY (will write to __drizzle_migrations)" : "DRY RUN (no writes)"}\n`);

// --- Load credentials strictly from .env.staging.local ---
const envPath = path.join(REPO_ROOT, ".env.staging.local");
const envResult = loadDotenv({ path: envPath });
if (envResult.error) {
  fail(`Could not load .env.staging.local: ${envResult.error.message}`);
}

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || !token) {
  fail(".env.staging.local did not provide TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.");
}

// --- Hostname safety gate (fail-closed) ---
const host = url.replace(/^libsql:\/\//, "").split(".")[0];
console.log("Resolved database host prefix:", host);

for (const bad of FORBIDDEN_HOST_SUBSTRINGS) {
  if (host.toLowerCase().includes(bad) && !host.startsWith(ALLOWED_HOST_PREFIX)) {
    fail(`Host contains forbidden substring "${bad}" and does not start with "${ALLOWED_HOST_PREFIX}". Aborting before any connection is used for writes.`);
  }
}
if (!host.startsWith(ALLOWED_HOST_PREFIX)) {
  fail(`Host "${host}" does not start with the required prefix "${ALLOWED_HOST_PREFIX}". This script only operates on superkuba-staging.`);
}
console.log("Safety gate PASSED: host matches", ALLOWED_HOST_PREFIX, "\n");

const client = createClient({ url, authToken: token });

// --- Verify existing application schema before doing anything else ---
const tablesResult = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
);
const tableCount = tablesResult.rows.length;
console.log("Application tables found:", tableCount, `(expected ${EXPECTED_TABLE_COUNT})`);
if (tableCount !== EXPECTED_TABLE_COUNT) {
  fail(`Expected exactly ${EXPECTED_TABLE_COUNT} application tables, found ${tableCount}. The live schema no longer matches the baseline this script was validated against.`);
}

// --- Refuse if a conflicting ledger already exists ---
const ledgerExists = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'");
let existingLedgerRows = [];
if (ledgerExists.rows.length > 0) {
  const rows = await client.execute("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id");
  existingLedgerRows = rows.rows;
  console.log(`__drizzle_migrations already exists with ${existingLedgerRows.length} row(s).`);
  if (existingLedgerRows.length > 0) {
    fail("A migration ledger already exists with rows in it. This script only seeds a ledger from a clean (nonexistent or empty) state and will not overwrite or append to an existing one. Investigate manually before proceeding.");
  }
  console.log("Existing ledger table is present but empty — safe to seed.");
} else {
  console.log("No existing __drizzle_migrations table — will be created.");
}

// --- Derive the exact seed values the real migrator would use (not guessed) ---
const migrations = readMigrationFiles({ migrationsFolder: DRIZZLE_DIR });
console.log("\nMigrations found via drizzle-orm's own readMigrationFiles():", migrations.length);
if (migrations.length === 0) {
  fail("readMigrationFiles() returned zero migrations — journal/migration folder state looks wrong.");
}
const last = migrations[migrations.length - 1];
console.log("Baseline migration folderMillis:", last.folderMillis);
console.log("Baseline migration hash (sha256, first 16 chars):", last.hash.slice(0, 16) + "...");
console.log("(Full hash and any credential values are never logged in full or at all.)");

if (isDryRun) {
  console.log("\n=== DRY RUN SUMMARY ===");
  console.log("Would create __drizzle_migrations with columns (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric).");
  console.log(`Would insert exactly 1 row: created_at = ${last.folderMillis}, hash = <sha256 of drizzle/0038_current_live_baseline.sql>.`);
  console.log("Would NOT touch any of the", tableCount, "application tables.");
  console.log("Would NOT run any historical migration SQL.");
  console.log("No writes performed. Re-run with --apply to execute.");
  client.close();
  process.exit(0);
}

// --- APPLY: create + seed the ledger, transactionally where supported ---
console.log("\n=== APPLYING ===");
const tx = await client.transaction("write");
try {
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);
  const existingInTx = await tx.execute("SELECT COUNT(*) as c FROM __drizzle_migrations");
  if (Number(existingInTx.rows[0].c) > 0) {
    await tx.rollback();
    fail("Ledger gained rows between the pre-check and the write (concurrent modification?). Rolled back, no changes made.");
  }
  await tx.execute({
    sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    args: [last.hash, last.folderMillis],
  });
  await tx.commit();
  console.log("Committed: __drizzle_migrations created and seeded with 1 row.");
} catch (err) {
  try { await tx.rollback(); } catch { /* already closed */ }
  fail(`Write failed, transaction rolled back: ${err.message}`);
}

// --- Post-write verification ---
const postTables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
);
console.log("Post-write application table count (must still be", EXPECTED_TABLE_COUNT, "):", postTables.rows.length);
if (postTables.rows.length !== EXPECTED_TABLE_COUNT) {
  fail("Application table count changed after the write. This should be impossible — investigate immediately.");
}
const postLedger = await client.execute("SELECT id, created_at FROM __drizzle_migrations ORDER BY id");
console.log("Post-write ledger row count (must be 1):", postLedger.rows.length, "| created_at:", postLedger.rows[0]?.created_at);

console.log("\nReconciliation complete. No application table was created, dropped, or altered.");
client.close();
