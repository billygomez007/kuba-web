// Regression tests for four launch-blocking defects found during the final
// pre-production customer certification pass:
//   1. Password reset emails were never sent (better-auth had no
//      sendResetPassword callback wired, despite a ready template and a
//      dedicated rate-limit rule implying the flow was meant to work).
//   2. A Paystack cancellation webhook nulled out currentPeriodEnd/trialEnd
//      unconditionally, immediately revoking access despite the billing
//      page's own promise that access continues until the period/trial end.
//   3. The Website Chat channel kept generating AI replies after a human
//      took over a conversation (no gate, unlike the WhatsApp webhook which
//      already had one) — a real double-reply / AI-overriding-human bug on
//      the one live channel not blocked by a missing provider credential.
//   4. The public, search-indexed /ai-employees marketing page had no header,
//      footer, or way back to the rest of the site — a real dead end for
//      organic visitors landing there first.
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

// --- 1. Password reset emails ---

test("lib/auth.ts wires sendResetPassword to the real password-reset email template, not left unconfigured", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/auth.ts"), "utf8");
  assert.match(source, /passwordResetEmailTemplate/);
  assert.match(source, /sendResetPassword:\s*async/);
  const emailAndPasswordBlock = source.match(/emailAndPassword:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(emailAndPasswordBlock, /sendResetPassword/);
  assert.match(emailAndPasswordBlock, /resend\.emails\.send/);
});

// --- 2. Cancellation preserves currentPeriodEnd/trialEnd until real expiry ---

let tempDir;
let db, schema, subscriptionService;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-billing-cert-"));
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
  subscriptionService = await import("@/lib/billing/subscription-service");
});

test.after(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("a cancellation event that carries no period-end data preserves the previously known currentPeriodEnd/trialEnd rather than nulling them", async () => {
  const { eq } = await import("drizzle-orm");
  const businessId = "cert-cancel-biz";
  const now = new Date();
  await db.insert(schema.businesses).values({ id: businessId, name: "Cert Cancel Biz", slug: "cert-cancel-biz", plan: "growth", status: "active", createdAt: now, updatedAt: now });

  const realTrialEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const realPeriodEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  await subscriptionService.saveSubscription(businessId, {
    provider: "paystack",
    providerCustomerId: "CUS_123",
    providerSubscriptionId: "SUB_123",
    providerEventId: "verified:initial",
    plan: "growth",
    status: "trialing",
    currentPeriodStart: now,
    currentPeriodEnd: realPeriodEnd,
    cancelAtPeriodEnd: false,
    trialEnd: realTrialEnd,
  });

  // Simulate the real Paystack subscription.disable webhook shape: status
  // flips to "canceled" but the parsed event carries null period/trial dates
  // (see lib/billing/provider.ts's paystackProvider.parseWebhook).
  await subscriptionService.saveSubscription(businessId, {
    provider: "paystack",
    providerCustomerId: "CUS_123",
    providerSubscriptionId: "SUB_123",
    providerEventId: "evt-cancel-1",
    plan: "growth",
    status: "canceled",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
  });

  const row = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId)))[0];
  assert.equal(row.status, "canceled");
  assert.equal(row.currentPeriodEnd?.getTime(), realPeriodEnd.getTime(), "currentPeriodEnd must survive a cancellation event that supplies no new date");
  assert.equal(row.trialEnd?.getTime(), realTrialEnd.getTime(), "trialEnd must survive a cancellation event that supplies no new date");

  const { getBusinessEntitlements } = await import("@/lib/billing/entitlements");
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "growth", "a just-canceled subscription must remain usable through its already-promised period end, not fall back to Starter immediately");
});

test("an event that DOES supply a new period end still overwrites the stored value (this is not a one-way ratchet)", async () => {
  const { eq } = await import("drizzle-orm");
  const businessId = "cert-cancel-biz-2";
  const now = new Date();
  await db.insert(schema.businesses).values({ id: businessId, name: "Cert Cancel Biz 2", slug: "cert-cancel-biz-2", plan: "pro", status: "active", createdAt: now, updatedAt: now });

  await subscriptionService.saveSubscription(businessId, {
    provider: "paystack", providerCustomerId: "CUS_2", providerSubscriptionId: "SUB_2", providerEventId: "evt-a",
    plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 1000), cancelAtPeriodEnd: false, trialEnd: null,
  });
  const newerPeriodEnd = new Date(now.getTime() + 999999);
  await subscriptionService.saveSubscription(businessId, {
    provider: "paystack", providerCustomerId: "CUS_2", providerSubscriptionId: "SUB_2", providerEventId: "evt-b",
    plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: newerPeriodEnd, cancelAtPeriodEnd: false, trialEnd: null,
  });

  const row = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId)))[0];
  assert.equal(row.currentPeriodEnd?.getTime(), newerPeriodEnd.getTime());
});

// --- 3. Website Chat human-takeover gate ---

test("the Website Chat route does not generate/store an AI reply once a conversation is assigned away from AI", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/integrations/website-chat/route.ts"), "utf8");
  const gateIndex = source.indexOf('routingDecision.assignmentType !== "ai"');
  const selectEmployeeIndex = source.indexOf("Select the routed AI employee");
  const generateIndex = source.indexOf("selectedAgent.generate(");
  assert.ok(gateIndex > -1, "expected a human-takeover gate checking routingDecision.assignmentType");
  assert.ok(selectEmployeeIndex > -1 && generateIndex > -1);
  assert.ok(gateIndex < selectEmployeeIndex, "the gate must run before AI employee selection");
  assert.ok(gateIndex < generateIndex, "the gate must run before the AI is asked to generate a reply");
  assert.match(source, /aiReplySkipped:\s*true/);
});

test("when the AI reply is skipped, the widget still gets a truthful response and its conversationId (not a silent/broken payload)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/integrations/website-chat/route.ts"), "utf8");
  const gateBlock = source.slice(source.indexOf('if (routingDecision.assignmentType !== "ai")'), source.indexOf('if (routingDecision.assignmentType !== "ai")') + 500);
  assert.match(gateBlock, /response:\s*"/);
  assert.match(gateBlock, /conversationId/);
});

test("regression guard: the WhatsApp webhook's own human-takeover gate is untouched", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/integrations/whatsapp/webhook/route.ts"), "utf8");
  assert.match(source, /routingDecision\.assignmentType !== "ai"/);
});

// --- 4. /ai-employees marketing page navigability ---

test("/ai-employees renders the shared MarketingHeader and a way back to the rest of the site (no longer a dead end for organic/search traffic)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/ai-employees/page.tsx"), "utf8");
  assert.match(source, /import MarketingHeader from "\.\.\/components\/MarketingHeader"/);
  assert.match(source, /<MarketingHeader \/>/);
  assert.match(source, /BackNavigation/);
});
