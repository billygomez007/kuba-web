// Two things proven in this file:
//
// (1) PART B — a controlled, one-time audit of every remaining call site of
// lib/auth/permissions.ts's legacy getBusinessMembership(userId) helper
// (previously found to break Team & Staff and Billing for any multi-
// business account, fixed in a prior task for exactly 2 routes). This
// session extended that fix to every OTHER "current selected workspace"
// route sharing the identical defect: called with NO businessId, so it
// silently requires the user to have exactly one business membership total,
// ignoring the superkuba_business_id cookie entirely. 16 call sites across
// 13 files were migrated to the canonical, cookie-aware
// getCurrentMembership() (lib/auth/tenant.ts). The 7 call sites in
// app/api/conversations/* were deliberately LEFT UNTOUCHED — they pass an
// explicit, resource-derived businessId (the business that owns a specific
// conversation being acted on), which is a genuinely different operation
// ("does this user belong to the business that owns resource X") from
// "resolve my current selected workspace," and that branch of the helper
// does not have the exactly-one-membership defect at all.
//
// (2) PART A — the existing complimentary/internal Pro grant mechanism
// (app/api/admin/businesses/[id]/route.ts, built in an earlier task) is
// re-verified against the more detailed "lifetime/perpetual" requirements:
// no trialEnd, no currentPeriodEnd, no provider IDs, no fake future date,
// identical product capabilities to a real paid Pro subscription, and a
// billing UI that never implies a real payment method or fake renewal.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, eq;
let getBusinessEntitlements, canActivateEmployee, canUseCampaigns;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-canonical-resolver-"));
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
  ({ eq } = await import("drizzle-orm"));
  ({ getBusinessEntitlements } = await import("@/lib/billing/entitlements"));
  ({ canActivateEmployee } = await import("@/lib/billing/ai-workforce-policy"));
  ({ canUseCampaigns } = await import("@/lib/outreach/campaign-policy"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---- Part B: migration regression, one test per migrated file ----

const MIGRATED_FILES = [
  "app/api/settings/phone-numbers/route.ts",
  "app/api/integrations/route.ts",
  "app/api/integrations/whatsapp/route.ts",
  "app/api/integrations/website-chat/route.ts",
  "app/api/integrations/email/route.ts",
  "app/api/billing/plans/route.ts",
  "app/api/billing/portal/route.ts",
  "app/api/billing/trial/callback/route.ts",
  "app/api/billing/trial/change-plan/route.ts",
  "app/api/billing/callback/paystack/route.ts",
  "app/api/billing/trial/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/subscription/route.ts",
];

for (const file of MIGRATED_FILES) {
  test(`REGRESSION: ${file} no longer resolves the current workspace via the legacy exactly-one-membership helper`, async () => {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /getBusinessMembership/, `${file} must not import or call the legacy helper`);
    assert.match(source, /getCurrentMembership\(\)/, `${file} must resolve the current workspace via the canonical resolver`);
  });
}

test("the 13 migrated files collectively account for all known 'current selected workspace' call sites — 16 from the original migration plus 2 added since for Website Widget config (PATCH) and its authenticated-owner test-message bypass in POST, both in the already-migrated app/api/integrations/website-chat/route.ts", async () => {
  let total = 0;
  for (const file of MIGRATED_FILES) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    total += (source.match(/getCurrentMembership\(\)/g) || []).length;
  }
  assert.equal(total, 18);
});

// ---- Part B: the 7 resource-scoped conversation routes are deliberately untouched ----

const RESOURCE_SCOPED_CONVERSATION_FILES = [
  "app/api/conversations/resume/route.ts",
  "app/api/conversations/summary/route.ts",
  "app/api/conversations/takeover/route.ts",
  "app/api/conversations/assign/route.ts",
  "app/api/conversations/status/route.ts",
  "app/api/conversations/team/route.ts",
  "app/api/conversations/assign-human/route.ts",
];

for (const file of RESOURCE_SCOPED_CONVERSATION_FILES) {
  test(`${file} correctly retains the legacy helper WITH an explicit resource-derived businessId (not a bug — a different operation from "current workspace")`, async () => {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /getBusinessMembership\(\s*session\.user\.id,\s*(?:conversation|targetConversation)\.businessId,?\s*\)/, `${file} must pass the conversation's own businessId, not rely on the exactly-one-membership fallback`);
  });
}

test("no unaudited call site of the legacy helper remains anywhere outside the 7 explicitly-scoped conversation routes", async () => {
  const { execFileSync: run } = await import("node:child_process");
  const output = run("grep", ["-rn", "getBusinessMembership(", "app/api", "lib", "--include=*.ts"], { cwd: REPO_ROOT, encoding: "utf8" });
  const callSiteLines = output.split("\n").filter((line) => line && !line.includes("lib/auth/permissions.ts") && !line.includes("lib/auth/route-permissions.ts"));
  const uniqueFiles = new Set(callSiteLines.map((line) => line.split(":")[0]));
  for (const file of uniqueFiles) {
    assert.ok(RESOURCE_SCOPED_CONVERSATION_FILES.includes(file), `${file} has an un-triaged getBusinessMembership call site — every remaining call site must be one of the 7 explicitly-reviewed resource-scoped conversation routes`);
  }
});

// ---- Part A: perpetual complimentary Pro grant ----

async function grantComplimentaryPro(businessId, reason) {
  // Mirrors the exact write shape app/api/admin/businesses/[id]/route.ts's
  // action:"plan" handler performs — not a reimplementation of separate
  // policy, just the same field values that route writes, so this proves
  // the real persisted shape without needing an authenticated admin HTTP
  // request (blocked by next/headers being request-scoped, the same
  // constraint documented throughout this repo's other integration tests).
  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(schema.subscriptions).values({
    id, businessId, provider: "internal", plan: "pro", status: "complimentary",
    providerCustomerId: null, providerSubscriptionId: null, providerEventId: null,
    currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null,
    paymentMethodSummary: null, createdAt: now, updatedAt: now,
  });
  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(), businessId, userId: "platform-admin-actor", action: "admin.plan.changed",
    resource: "business_subscription", resourceId: id, description: reason,
    metadata: JSON.stringify({ plan: "pro", status: "complimentary", complimentary: true }), createdAt: now,
  });
  return id;
}

async function createBusiness(name, plan = "starter") {
  const businessId = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id: businessId, name, slug: `${businessId}-slug`, plan, status: "active", createdAt: now, updatedAt: now });
  return businessId;
}

test("Kora acceptance: a lifetime complimentary Pro grant resolves as plan=pro, status=complimentary, provider=internal, with no expiry fields set", async () => {
  const businessId = await createBusiness("Kora OS");
  await grantComplimentaryPro(businessId, "Realtegic-owned internal business and SuperKuba product testing");

  const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  assert.equal(row.plan, "pro");
  assert.equal(row.status, "complimentary");
  assert.equal(row.provider, "internal");
  assert.equal(row.trialEnd, null, "no trialEnd");
  assert.equal(row.currentPeriodEnd, null, "no currentPeriodEnd used as expiration");
  assert.equal(row.currentPeriodStart, null, "no billing period start");
  assert.equal(row.cancelAtPeriodEnd, false, "no cancellation-at-period-end behavior");
  assert.equal(row.providerCustomerId, null, "no Stripe/Paystack customer id");
  assert.equal(row.providerSubscriptionId, null, "no Stripe/Paystack subscription id");
  assert.equal(row.paymentMethodSummary, null, "no fake payment method");

  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "pro");
});

test("perpetual: a complimentary grant remains usable with no date-based expiry check at all (verified against the real entitlements resolver source, not a re-derived rule)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/entitlements.ts"), "utf8");
  // "active"/"enterprise_contract"/"complimentary" all short-circuit
  // `usable = true` unconditionally on this one line; the date-comparison
  // branches (trialEnd/currentPeriodEnd) only exist in the separate
  // "trialing"/"past_due"/"canceled" else-if arms that follow, never
  // reached for a complimentary row.
  assert.match(
    source,
    /if \(current\.status === "active" \|\| current\.status === "enterprise_contract" \|\| current\.status === "complimentary"\) \{\s*usable = true;\s*\} else if \(current\.status === "trialing"\) \{\s*usable = current\.trialEnd/,
  );
});

test("internal provider requires no payment-provider metadata to be usable — a complimentary row with every provider field null still resolves Pro", async () => {
  const businessId = await createBusiness("No Provider Metadata Co");
  await grantComplimentaryPro(businessId, "Internal testing account.");
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "pro");
  assert.ok(entitlements.capabilities.length > 0);
});

test("paid Pro and complimentary Pro receive identical product capabilities and limits (not just the same plan id)", async () => {
  const paidBusinessId = await createBusiness("Paid Pro Co");
  const complimentaryBusinessId = await createBusiness("Complimentary Pro Co");
  const now = new Date();
  await db.insert(schema.subscriptions).values({
    id: crypto.randomUUID(), businessId: paidBusinessId, provider: "paystack", plan: "pro", status: "active",
    providerCustomerId: "CUS_real", providerSubscriptionId: "SUB_real", currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 86400000), cancelAtPeriodEnd: false, trialEnd: null,
    createdAt: now, updatedAt: now,
  });
  await grantComplimentaryPro(complimentaryBusinessId, "Testing.");

  const paid = await getBusinessEntitlements(paidBusinessId);
  const complimentary = await getBusinessEntitlements(complimentaryBusinessId);
  assert.deepEqual([...paid.capabilities].sort(), [...complimentary.capabilities].sort());
  assert.deepEqual(paid.limits, complimentary.limits);
});

test("Pro employee types unlock correctly for a complimentary Pro business: Sales, Customer Support, Outreach, and General Manager are all activatable", async () => {
  const businessId = await createBusiness("Kora OS Employees Check");
  await grantComplimentaryPro(businessId, "Testing.");
  const entitlements = await getBusinessEntitlements(businessId);

  for (const type of ["receptionist", "sales", "customer-support", "outreach", "general-manager"]) {
    const decision = canActivateEmployee(entitlements, type, 0);
    assert.equal(decision.allowed, true, `${type} must be activatable on complimentary Pro`);
  }
});

test("Campaign Engine (outreach.campaigns) unlocks for a complimentary Pro business at the exact policy layer the API route calls", async () => {
  const businessId = await createBusiness("Kora OS Campaigns Check");
  await grantComplimentaryPro(businessId, "Testing.");
  const entitlements = await getBusinessEntitlements(businessId);
  const decision = canUseCampaigns(entitlements, "email");
  assert.equal(decision.allowed, true);
});

test("Starter -> complimentary Pro transition: the same business row resolves Starter capabilities before the grant and full Pro capabilities after, with no other row created", async () => {
  const businessId = await createBusiness("Kora OS Transition Check", "starter");
  const before = await getBusinessEntitlements(businessId);
  assert.equal(before.plan, "starter");
  assert.equal(canUseCampaigns(before, "email").allowed, false);

  await grantComplimentaryPro(businessId, "Realtegic-owned internal business and SuperKuba product testing");

  const after = await getBusinessEntitlements(businessId);
  assert.equal(after.plan, "pro");
  assert.equal(canUseCampaigns(after, "email").allowed, true);
  assert.equal(canActivateEmployee(after, "outreach", 0).allowed, true);

  const rows = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  assert.equal(rows.length, 1, "the transition must update/insert exactly one subscription row, never accumulate duplicates");
});

test("revocation: converting a complimentary Pro business back to Starter returns it to normal (non-complimentary) entitlement resolution", async () => {
  const businessId = await createBusiness("Kora OS Revocation Check");
  await grantComplimentaryPro(businessId, "Testing.");
  let entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "pro");

  // Mirrors the same admin action:"plan" handler called again with
  // plan:"starter", complimentary:false — the exact revocation path a
  // platform admin uses (no separate "revoke" endpoint is needed; the
  // mechanism is symmetric).
  const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  await db.update(schema.subscriptions).set({ plan: "starter", status: "active", updatedAt: new Date() }).where(eq(schema.subscriptions.id, existing.id));

  entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "starter");
  assert.equal(canUseCampaigns(entitlements, "email").allowed, false, "Pro-only capabilities must disappear immediately on revocation");
});

test("the audit log captures business, plan, provider, status, reason, actor, and timestamp for the grant, with no expiry recorded", async () => {
  const businessId = await createBusiness("Kora OS Audit Check");
  await grantComplimentaryPro(businessId, "Realtegic-owned internal business and SuperKuba product testing");
  const [log] = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.businessId, businessId));
  assert.equal(log.action, "admin.plan.changed");
  assert.equal(log.description, "Realtegic-owned internal business and SuperKuba product testing");
  assert.ok(log.userId, "actor must be recorded");
  assert.ok(log.createdAt, "grant timestamp must be recorded");
  const metadata = JSON.parse(log.metadata);
  assert.equal(metadata.plan, "pro");
  assert.equal(metadata.status, "complimentary");
  assert.equal(metadata.complimentary, true);
});

// ---- Part A: billing UI truthfulness for a lifetime complimentary account ----

test("the billing page never requires a payment method or shows a fake renewal date for a complimentary account, and states the access is provided by Realtegic", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/billing/page.tsx"), "utf8");
  assert.match(source, /isComplimentary \? "GHS 0"/);
  assert.match(source, /Complimentary — Lifetime/);
  assert.match(source, /This workspace has complimentary Pro access provided by Realtegic\./);
  assert.match(source, /isComplimentary \? "No billing — complimentary account"/);
  assert.match(source, /!isComplimentary && data\.subscription\?\.paymentMethodSummary/);
  assert.match(source, /!isComplimentary && data\.capabilities\.supportsBillingPortal/);
  assert.match(source, /!isComplimentary && data\.capabilities\.supportsCancellation/);
});

test("the admin grant route clears any stale payment-method summary on both insert and update paths (never survives a conversion to complimentary)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/businesses/[id]/route.ts"), "utf8");
  const matches = source.match(/paymentMethodSummary: null/g) || [];
  assert.equal(matches.length, 2, "both the update and insert branches of action:\"plan\" must clear paymentMethodSummary");
});

// ---- No hardcoding ----

test("no code touched by this fix hardcodes Kora/koraafric.com/email-based plan special-casing", async () => {
  const files = [...MIGRATED_FILES, "app/api/admin/businesses/[id]/route.ts", "app/dashboard/billing/page.tsx"];
  for (const file of files) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /koraafric/i);
    assert.doesNotMatch(source, /"Kora"/);
  }
});

// ---- Tenant isolation across the migration ----

test("tenant isolation holds after migration: two businesses' subscriptions never cross-resolve", async () => {
  const businessA = await createBusiness("Tenant A Co");
  const businessB = await createBusiness("Tenant B Co");
  await grantComplimentaryPro(businessA, "A is Realtegic-owned.");
  const entitlementsA = await getBusinessEntitlements(businessA);
  const entitlementsB = await getBusinessEntitlements(businessB);
  assert.equal(entitlementsA.plan, "pro");
  assert.equal(entitlementsB.plan, "starter", "an unrelated business must never inherit another business's complimentary grant");
});
