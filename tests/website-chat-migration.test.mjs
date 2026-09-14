import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { readMigrationFiles } from "drizzle-orm/migrator";

const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
const read = (path) => readFileSync(`${folder}/${path}`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Historical read-only audit baseline, NOT proof of current production state.
const reviewedProductionTimestamp = 1788117804308;

test("provider execution set contains only the unchanged 0045 after the reviewed ledger cutoff", () => {
  // Metadata reader only: never invoke a migrator or open a database.
  const pending = readMigrationFiles({ migrationsFolder: folder })
    .filter((entry) => entry.folderMillis > reviewedProductionTimestamp);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].folderMillis, 1789341443148);
  assert.equal(pending[0].hash, "7c0694aae092bf8427a4eef01499a77498dc91ce6c2977a1a2bb23ddd0bd56b9");
  assert.equal(read("0045_superkuba_widget_origins.sql").toString(),
    "ALTER TABLE `integrations` ADD `allowed_origins` text;\n");
});

test("provider journal excludes superseded and unrelated branch migrations", () => {
  const journal = JSON.parse(read("meta/_journal.json"));
  assert.deepEqual(journal.entries.at(-1), {
    idx: 38, version: "6", when: 1789341443148,
    tag: "0045_superkuba_widget_origins", breakpoints: true,
  });
  for (const tag of [
    "0039_superkuba_widget_origins", "0040_whatsapp_message_status",
    "0041_integration_webhook_health", "0042_silky_steve_rogers",
    "0042_cuddly_starhawk", "0043_outreach_campaign_engine", "0044_steep_human_torch",
  ]) {
    assert.equal(journal.entries.some((entry) => entry.tag === tag), false, tag);
  }
  assert.equal(existsSync(`${folder}/0039_superkuba_widget_origins.sql`), false);
  assert.equal(existsSync(`${folder}/meta/0039_snapshot.json`), false);
});

test("0045 snapshot retains its reviewed bytes and 0038 lineage", () => {
  const bytes = read("meta/0045_snapshot.json");
  assert.equal(sha256(bytes), "9d5b7759b3bee0de4a8bca878faf05338a608251d5defb7fad16ce52522eda23");
  const snapshot = JSON.parse(bytes);
  const baseline = JSON.parse(read("meta/0038_snapshot.json"));
  assert.equal(snapshot.prevId, baseline.id);
  const column = snapshot.tables.integrations.columns.allowed_origins;
  assert.equal(column.type, "text");
  assert.equal(column.notNull, false);
  assert.equal(Object.hasOwn(column, "default"), false);
});
