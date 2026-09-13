// Real-DB integration tests for the "complimentary" subscription status —
// added to safely represent an admin-granted, non-paying, internally
// authorized business (e.g. a Realtegic-owned workspace) as a genuinely
// truthful Pro account, never a disguised paid subscription. See
// app/api/admin/businesses/[id]/route.ts (the grant mechanism) and
// lib/billing/entitlements.ts (the resolution logic this test exercises
// directly against a real sqlite-backed database, matching the pattern used
// by tests/outreach-campaign-crud-integration.test.mjs).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, entitlements;

const BIZ_COMPLIMENTARY = "biz-complimentary-pro";
const BIZ_NORMAL_STARTER = "biz-normal-starter";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-complimentary-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  entitlements = await import("@/lib/billing/entitlements");

  const now = new Date();
  await db.insert(schema.businesses).values([
    { id: BIZ_COMPLIMENTARY, name: "Kora", slug: BIZ_COMPLIMENTARY, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_NORMAL_STARTER, name: "Normal Starter Co", slug: BIZ_NORMAL_STARTER, status: "active", createdAt: now, updatedAt: now },
  ]);

  // The exact shape app/api/admin/businesses/[id]/route.ts's action:"plan"
  // handler writes for a complimentary Pro grant: provider "internal",
  // status "complimentary", no provider IDs, no period/trial dates.
  await db.insert(schema.subscriptions).values({
    id: "sub-complimentary",
    businessId: BIZ_COMPLIMENTARY,
    provider: "internal",
    providerCustomerId: null,
    providerSubscriptionId: null,
    providerEventId: null,
    plan: "pro",
    status: "complimentary",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    createdAt: now,
    updatedAt: now,
  });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("a complimentary-status subscription resolves the full Pro plan and capabilities, with no date-based expiry", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_COMPLIMENTARY);
  assert.equal(result.plan, "pro");
  assert.equal(result.planName, "Pro");
  assert.ok(result.capabilities.includes("outreach.campaigns"), "Pro's Campaign Engine capability must be present");
  assert.ok(result.capabilities.includes("customer_ops.ai_assist"));
});

test("complimentary status is usable even though currentPeriodEnd and trialEnd are both null — no accidental downgrade from a missing payment webhook", async () => {
  // This is the exact concern a payment-provider-dependent status check
  // would get wrong: "active"/"trialing" normally lean on a real date, but
  // an internally-granted complimentary account has no such date to check,
  // by design — the admin grant itself is the authority.
  const result = await entitlements.getBusinessEntitlements(BIZ_COMPLIMENTARY);
  assert.equal(result.plan, "pro");
});

test("a normal Starter business (no override) is unaffected — complimentary status doesn't leak into unrelated businesses", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_NORMAL_STARTER);
  assert.equal(result.plan, "starter");
  assert.equal(result.capabilities.includes("outreach.campaigns"), false);
});

test("getBusinessPlan reflects the complimentary business as Pro with Pro's real limits (not a special uncapped exemption)", async () => {
  const plan = await entitlements.getBusinessPlan(BIZ_COMPLIMENTARY);
  assert.equal(plan.id, "pro");
  assert.equal(plan.employeeLimit, 10);
});
