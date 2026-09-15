import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
test("native CRM deal routes scope reads and writes to current membership business", () => {
  const source = fs.readFileSync(path.join(ROOT, "app/api/crm/deals/route.ts"), "utf8");
  assert.match(source, /getCurrentMembership/);
  assert.match(source, /eq\(crmDeals\.businessId, membership\.businessId\)/);
  assert.match(source, /Stage does not belong to this pipeline/);
});
test("CRM migration uses provider-neutral pipeline and deal entities", () => {
  const migration = fs.readFileSync(path.join(ROOT, "drizzle/0049_native_crm_pipelines_deals.sql"), "utf8");
  assert.match(migration, /CREATE TABLE crm_pipelines/);
  assert.match(migration, /CREATE TABLE crm_pipeline_stages/);
  assert.match(migration, /CREATE TABLE crm_deals/);
  assert.doesNotMatch(migration, /hubspot|salesforce|zoho|pipedrive/i);
});
