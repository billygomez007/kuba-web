import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const jobs = await readFile(new URL("../app/api/marketing/publish-jobs/route.ts", import.meta.url), "utf8");
const audiences = await readFile(new URL("../lib/marketing/context.ts", import.meta.url), "utf8");

test("native marketing schema is tenant-scoped and provider-neutral", () => {
  for (const table of ["marketingCampaigns", "marketingContentItems", "marketingContentVariants", "marketingAudiences", "marketingAssets", "marketingApprovals", "marketingSocialAccounts", "marketingPublishJobs", "marketingAttributions", "marketingMetricSnapshots"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
  assert.match(schema, /businessId: text\("business_id"\)\.notNull\(\)/g);
});

test("publishing never claims success without a provider adapter", () => {
  assert.match(jobs, /PUBLISHING_ADAPTER_UNAVAILABLE/);
  assert.doesNotMatch(jobs, /status:\s*["']published["']/);
});

test("audience field allowlist excludes protected targeting", () => {
  assert.match(audiences, /SAFE_AUDIENCE_FIELDS/);
  for (const forbidden of ["race", "ethnicity", "religion", "political", "health", "disability"]) assert.doesNotMatch(audiences, new RegExp(`\\b${forbidden}\\b`, "i"));
});
