#!/usr/bin/env node

/**
 * Build a new empty local database from the authoritative Drizzle schema.
 *
 * This is intentionally separate from drizzle-kit migrate: historical
 * migrations 0000-0037 contain unreplayable live-schema assumptions. A clean
 * database bootstrapped here starts at the latest legitimate repository
 * migration, after which normal generated migrations can continue.
 *
 * Safety: only file: SQLite URLs are accepted. Never point this at Turso.
 * Usage: CLEAN_BOOTSTRAP_DATABASE_URL=file:/path/to/db node scripts/bootstrap-clean-database.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { readMigrationFiles } from "drizzle-orm/migrator";

const databaseUrl = process.env.CLEAN_BOOTSTRAP_DATABASE_URL || "";
if (!databaseUrl.startsWith("file:")) {
  throw new Error("Refusing clean bootstrap: CLEAN_BOOTSTRAP_DATABASE_URL must be a local file: URL.");
}

const repositoryRoot = process.cwd();
const migrationFolder = path.join(repositoryRoot, "drizzle");
const client = createClient({ url: databaseUrl });
const schemaSql = execFileSync("npx", ["drizzle-kit", "export", "--dialect", "turso", "--schema", "./db/schema.ts"], {
  cwd: repositoryRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

await client.executeMultiple(schemaSql);
const migrations = readMigrationFiles({ migrationsFolder: migrationFolder });
const baseline = migrations.at(-1);
if (!baseline || baseline.folderMillis < 1787700000000) {
  throw new Error("Refusing clean bootstrap: repository has no repaired migration baseline.");
}
await client.execute("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)");
await client.execute({
  sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
  args: [baseline.hash, baseline.folderMillis],
});

const tables = await client.execute("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
console.log(JSON.stringify({ databaseType: "local-file", applicationTableCount: Number(tables.rows[0].count) - 1, migrationCount: 1, baseline: baseline.folder }));
client.close();

if (process.env.CLEAN_BOOTSTRAP_KEEP !== "1" && databaseUrl.startsWith("file:") && databaseUrl.slice(5) !== ":memory:" && existsSync(databaseUrl.slice(5))) {
  unlinkSync(databaseUrl.slice(5));
}
