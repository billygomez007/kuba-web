import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);

async function schemaFingerprint(client) {
  const tables = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('__drizzle_migrations', 'migration_probe') ORDER BY name");
  const fingerprint = [];
  for (const table of tables.rows) {
    const tableName = String(table.name);
    const columns = await client.execute(`PRAGMA table_info(${JSON.stringify(tableName)})`);
    const foreignKeys = await client.execute(`PRAGMA foreign_key_list(${JSON.stringify(tableName)})`);
    const indexes = await client.execute(`PRAGMA index_list(${JSON.stringify(tableName)})`);
    const indexDetails = [];
    for (const index of indexes.rows) {
      const indexName = String(index.name);
      const details = await client.execute(`PRAGMA index_info(${JSON.stringify(indexName)})`);
      indexDetails.push({ ...index, columns: details.rows });
    }
    fingerprint.push({ table, columns: columns.rows, foreignKeys: foreignKeys.rows, indexes: indexDetails });
  }
  return JSON.stringify(fingerprint);
}

test("clean bootstrap reproduces the current schema and accepts a generated future migration", async () => {
  const temporaryRoot = await mkdtemp(path.join(repositoryRoot, ".migration-repro-"));
  const databasePath = path.join(temporaryRoot, "database.db");
  const migrationFolder = path.join(temporaryRoot, "drizzle");
  try {
    execFileSync("node", [path.join(repositoryRoot, "scripts/bootstrap-clean-database.mjs")], {
      cwd: repositoryRoot,
      env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
      stdio: "pipe",
    });

    const client = createClient({ url: `file:${databasePath}` });
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    assert.equal(tables.rows.length, 90);
    assert.equal(tables.rows.some((row) => row.name === "__drizzle_migrations"), true);
    const emptyTables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' AND sql NOT LIKE '%WITHOUT ROWID%'");
    for (const table of emptyTables.rows) {
      const count = await client.execute(`SELECT count(*) AS count FROM ${JSON.stringify(String(table.name))}`);
      assert.equal(Number(count.rows[0].count), 0, `Expected bootstrapped table ${table.name} to be empty`);
    }
    const beforeFutureMigration = await schemaFingerprint(client);

    await cp(path.join(repositoryRoot, "drizzle"), migrationFolder, { recursive: true });
    const schemaPath = path.join(temporaryRoot, "schema.ts");
    const schema = await readFile(path.join(repositoryRoot, "db/schema.ts"), "utf8");
    await writeFile(schemaPath, `${schema}\nexport const migrationProbe = sqliteTable("migration_probe", { id: text("id").primaryKey(), createdAt: integer("created_at").notNull() });\n`);
    const existingMigrationFiles = new Set((await readdir(migrationFolder)).filter((file) => file.endsWith(".sql")));
    const configPath = path.join(temporaryRoot, "drizzle.config.ts");
    const relativeSchemaPath = `./${path.relative(repositoryRoot, schemaPath)}`;
    const relativeMigrationFolder = `./${path.relative(repositoryRoot, migrationFolder)}`;
    const relativeConfigPath = `./${path.relative(repositoryRoot, configPath)}`;
    await writeFile(configPath, `export default { schema: ${JSON.stringify(relativeSchemaPath)}, out: ${JSON.stringify(relativeMigrationFolder)}, dialect: "turso", dbCredentials: { url: "file:${databasePath}", authToken: "" } };\n`);
    execFileSync("npx", ["drizzle-kit", "generate", "--config", relativeConfigPath, "--name", "migration_probe"], { cwd: repositoryRoot, stdio: "pipe" });

    const generated = await readdir(migrationFolder);
    const generatedMigration = generated.find((file) => file.endsWith(".sql") && !existingMigrationFiles.has(file));
    assert.ok(generatedMigration, `No generated migration found. Files: ${generated.join(",")}`);
    const migrationSql = await readFile(path.join(migrationFolder, generatedMigration), "utf8");
    assert.match(migrationSql, /CREATE TABLE[^(]*migration_probe/i);
    assert.doesNotMatch(migrationSql, /DROP TABLE|DROP COLUMN|ALTER TABLE [`"](?!migration_probe)/i);

    const metadata = await import("drizzle-orm/libsql");
    const { drizzle } = metadata;
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    await migrate(drizzle(client), { migrationsFolder: migrationFolder });
    const probe = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_probe'");
    const ledger = await client.execute("SELECT count(*) AS count FROM __drizzle_migrations");
    assert.equal(probe.rows.length, 1);
    assert.equal(Number(ledger.rows[0].count), 2);
    assert.equal(await schemaFingerprint(client), beforeFutureMigration);
    client.close();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});