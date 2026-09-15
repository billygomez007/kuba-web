import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createClient } = require("@libsql/client");
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("migration journal preserves historical widget 0045 and renumbers metadata", async () => {
  const journal = JSON.parse(await readFile(path.join(ROOT, "drizzle/meta/_journal.json"), "utf8"));
  const tail = journal.entries.slice(-4).map((entry) => entry.tag);
  assert.deepEqual(tail, [
    "0044_steep_human_torch",
    "0045_superkuba_widget_origins",
    "0046_organization_portfolio_reconciliation",
    "0047_add_message_metadata",
  ]);
  assert.equal((await readFile(path.join(ROOT, "drizzle/0045_superkuba_widget_origins.sql"), "utf8")).trim(), "ALTER TABLE `integrations` ADD `allowed_origins` text;");
  assert.match(await readFile(path.join(ROOT, "drizzle/0047_add_message_metadata.sql"), "utf8"), /ADD `metadata` text/);
});

test("organization reconciliation is idempotent and preserves existing rows", async () => {
  const db = createClient({ url: "file::memory:" });
  await db.execute("CREATE TABLE businesses (id text PRIMARY KEY NOT NULL, name text NOT NULL)");
  await db.execute("CREATE TABLE integrations (id text PRIMARY KEY NOT NULL, business_id text NOT NULL, allowed_origins text)");
  await db.execute("INSERT INTO businesses VALUES ('realtegic-id', 'Realtegic Empire')");
  await db.execute("INSERT INTO integrations VALUES ('widget-id', 'realtegic-id', '[\"https://www.realtegicworks.com\"]')");
  const sql = await readFile(path.join(ROOT, "drizzle/0046_organization_portfolio_reconciliation.sql"), "utf8");
  const statements = sql.split(/--> statement-breakpoint/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await db.execute(statement);
  for (const statement of statements) await db.execute(statement);
  const objects = await db.execute("SELECT name FROM sqlite_master WHERE name IN ('organizations','organization_members','organization_businesses') ORDER BY name");
  assert.deepEqual(objects.rows.map((row) => row.name), ["organization_businesses", "organization_members", "organizations"]);
  const business = await db.execute("SELECT * FROM businesses");
  const integration = await db.execute("SELECT * FROM integrations");
  assert.equal(business.rows.length, 1);
  assert.equal(integration.rows[0].allowed_origins, '[\"https://www.realtegicworks.com\"]');
  db.close();
});
