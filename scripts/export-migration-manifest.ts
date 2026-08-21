import { createClient } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ManifestObject = {
  type: string;
  name: string;
  tableName: string;
  sql: string | null;
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function gitValue(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error(
      "Usage: tsx scripts/export-migration-manifest.ts <output-file>",
    );
  }

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!databaseUrl || !authToken) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.");
  }

  const client = createClient({ url: databaseUrl, authToken });
  try {
    const objectsResult = await client.execute(
      `SELECT type, name, tbl_name AS table_name, sql
       FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE 'mastra_%'
       ORDER BY CASE type
         WHEN 'table' THEN 0
         WHEN 'index' THEN 1
         WHEN 'trigger' THEN 2
         WHEN 'view' THEN 3
         ELSE 4
       END, name`,
    );
    const objects = objectsResult.rows.map((row) => ({
      type: String(row.type),
      name: String(row.name),
      tableName: String(row.table_name),
      sql: row.sql === null ? null : String(row.sql),
    })) satisfies ManifestObject[];
    const tableNames = objects
      .filter(
        (object) =>
          object.type === "table" && object.name !== "__drizzle_migrations",
      )
      .map((object) => object.name);

    const tables: Record<string, unknown> = {};
    for (const tableName of tableNames) {
      const quotedTable = quoteIdentifier(tableName);
      const [columns, indexList, foreignKeys, count] = await Promise.all([
        client.execute(`PRAGMA table_info(${quotedTable})`),
        client.execute(`PRAGMA index_list(${quotedTable})`),
        client.execute(`PRAGMA foreign_key_list(${quotedTable})`),
        client.execute(`SELECT COUNT(*) AS count FROM ${quotedTable}`),
      ]);
      const indexes = await Promise.all(
        indexList.rows.map(async (index) => ({
          name: String(index.name),
          unique: Boolean(index.unique),
          origin: String(index.origin),
          partial: Boolean(index.partial),
          columns: (
            await client.execute(
              `PRAGMA index_info(${quoteIdentifier(String(index.name))})`,
            )
          ).rows,
        })),
      );

      tables[tableName] = {
        columns: columns.rows,
        indexes,
        foreignKeys: foreignKeys.rows,
        rowCount: Number(count.rows[0]?.count ?? 0),
      };
    }

    const drizzleMigrations = (
      await client.execute(
        "SELECT * FROM __drizzle_migrations ORDER BY created_at, id",
      )
    ).rows;

    const manifest = {
      format: "kuba-drizzle-schema-manifest/v1",
      capturedAt: new Date().toISOString(),
      captureScope:
        "Schema metadata, indexes, foreign keys, row counts, and Drizzle ledger only; no table data or credentials.",
      application: {
        gitCommit: gitValue(["rev-parse", "HEAD"]),
        gitBranch: gitValue(["branch", "--show-current"]),
        packageVersion: process.env.npm_package_version ?? "0.1.0",
        nodeVersion: process.version,
      },
      sqliteMaster: objects,
      tables,
      drizzleMigrations,
    };

    const resolvedOutputPath = path.resolve(outputPath);
    await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await writeFile(
      resolvedOutputPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    console.log(`Wrote schema-only manifest to ${resolvedOutputPath}`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
