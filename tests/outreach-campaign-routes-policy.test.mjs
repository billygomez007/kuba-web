// Static policy checks for the Campaign Engine's thin API routes (section
// 41: authorization). Mirrors tests/whatsapp-webhook-policy.test.mjs's
// style — these assert invariants about route source without executing
// them through the Next.js runtime. Real cross-tenant enforcement at the
// data layer (a business can never read/mutate another business's
// campaign/recipient rows) is exercised end-to-end in
// tests/outreach-campaign-crud-integration.test.mjs.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROUTES_ROOT = "app/api/outreach/campaigns";

async function findRouteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    // The cron endpoint is a system route authenticated by CRON_SECRET,
    // not a user-facing tenant-scoped route — it is covered separately by
    // tests/outreach-campaign-worker-policy.test.mjs.
    if (entry.isDirectory() && entry.name === "cron") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findRouteFiles(full)));
    } else if (entry.name === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

let routeSources;

test.before(async () => {
  const files = await findRouteFiles(ROUTES_ROOT);
  routeSources = await Promise.all(
    files.map(async (file) => ({ file, source: await readFile(file, "utf8") })),
  );
  assert.ok(routeSources.length >= 10, `expected at least 10 campaign route files, found ${routeSources.length}`);
});

test("every campaign route resolves tenant via requireCampaignAccess, never trusting a client-supplied businessId", () => {
  for (const { file, source } of routeSources) {
    assert.match(source, /requireCampaignAccess\(/, `${file} must call requireCampaignAccess`);
    assert.doesNotMatch(source, /body\??\.businessId/, `${file} must not read businessId from the request body`);
    assert.doesNotMatch(source, /searchParams\.get\("businessId"\)/, `${file} must not read businessId from the query string`);
  }
});

test("every campaign route checks access before doing any service-layer work", () => {
  for (const { file, source } of routeSources) {
    const accessIndex = source.indexOf("requireCampaignAccess(");
    const okCheckIndex = source.indexOf("if (!access.ok)");
    assert.ok(accessIndex > -1 && okCheckIndex > -1, `${file} must check access.ok immediately`);
    assert.ok(accessIndex < okCheckIndex, `${file} must check access.ok right after resolving it`);
  }
});

test("mutating routes (POST/PATCH/DELETE) require the 'manage' permission, not merely 'view'", async () => {
  const mutatingFiles = routeSources.filter(({ file }) => !file.endsWith("/campaigns/route.ts") || true);
  for (const { file, source } of mutatingFiles) {
    const hasPost = /export async function POST/.test(source);
    const hasPatch = /export async function PATCH/.test(source);
    const hasDelete = /export async function DELETE/.test(source);
    if (hasPost || hasPatch || hasDelete) {
      assert.match(source, /requireCampaignAccess\("manage"\)/, `${file} has a mutating handler and must require "manage"`);
    }
  }
});

test("launch and schedule routes re-check campaign entitlement/policy before acting, not just at campaign creation", async () => {
  const launch = routeSources.find(({ file }) => file.endsWith("/launch/route.ts"));
  const schedule = routeSources.find(({ file }) => file.endsWith("/schedule/route.ts"));
  assert.ok(launch && schedule);
  for (const { source } of [launch, schedule]) {
    assert.match(source, /canUseCampaigns\(/);
    assert.match(source, /getBusinessEntitlements\(access\.businessId\)/);
  }
});

test("lifecycle action routes (launch/schedule/pause/resume/stop) delegate to the centralized lifecycle module, never mutating status inline", async () => {
  const actionFiles = routeSources.filter(({ file }) =>
    /\/(launch|schedule|pause|resume|stop)\/route\.ts$/.test(file),
  );
  assert.equal(actionFiles.length, 5);
  for (const { file, source } of actionFiles) {
    assert.doesNotMatch(source, /\.set\(\s*\{\s*status:/, `${file} must not set outreach_campaigns.status directly`);
    assert.match(source, /from "@\/lib\/outreach\/campaign-lifecycle"/, `${file} must import from the centralized lifecycle module`);
  }
});

test("the stop route's own doc comment records that stop is idempotent", async () => {
  const stop = routeSources.find(({ file }) => file.endsWith("/stop/route.ts"));
  assert.match(stop.source, /[Ii]dempotent/);
});
