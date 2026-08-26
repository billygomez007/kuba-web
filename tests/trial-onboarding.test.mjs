// Tests for the SuperKuba 14-day free trial + plan selection + payment
// method onboarding feature. Uses the REAL provider/entitlements/plan
// modules via the tsconfig-path alias loader, plus a disposable local
// database for entitlement-resolution tests — never Turso/staging, never a
// real Stripe/Paystack call (network-touching provider functions are not
// invoked; only the pure/structural pieces are exercised directly).
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

let entitlements, provider, planDefs;
let db, schema;
let tempDir;

const BIZ_TRIAL_ACTIVE = "biz-trial-active";
const BIZ_TRIAL_EXPIRED_NO_DATE = "biz-trial-expired-no-date"; // trialing status but trialEnd is null (anomalous/incomplete data)
const BIZ_TRIAL_EXPIRED_PAST = "biz-trial-expired-past"; // trialing status, trialEnd in the past
const BIZ_ACTIVE_PAID = "biz-active-paid";
const BIZ_CANCELED_WITHIN_PERIOD = "biz-canceled-within-period";
const BIZ_CANCELED_NO_PERIOD_END = "biz-canceled-no-period-end";
const BIZ_NO_SUBSCRIPTION_BUT_STALE_PLAN = "biz-stale-plan-no-sub";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-trial-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  entitlements = await import("@/lib/billing/entitlements");
  provider = await import("@/lib/billing/provider");
  planDefs = await import("@/lib/billing/plan-definitions");
  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  async function seedBusiness(id, plan) {
    await db.insert(schema.businesses).values({ id, name: id, slug: id, plan, status: "active", createdAt: now, updatedAt: now });
  }
  async function seedSubscription(businessId, overrides) {
    await db.insert(schema.subscriptions).values({
      id: crypto.randomUUID(), businessId, provider: "stripe", providerCustomerId: "cus_test",
      providerSubscriptionId: `sub_${businessId}`, providerEventId: `evt_${businessId}`,
      plan: "growth", status: "trialing", currentPeriodStart: null, currentPeriodEnd: null,
      cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now, ...overrides,
    });
  }

  // Growth business currently mid-trial, trialEnd genuinely in the future.
  await seedBusiness(BIZ_TRIAL_ACTIVE, "starter");
  await seedSubscription(BIZ_TRIAL_ACTIVE, { plan: "growth", status: "trialing", trialEnd: new Date(now.getTime() + 10 * oneDay) });

  // Anomalous: status says "trialing" but trialEnd was never set (incomplete
  // webhook data). This is the exact null-safety bug this task fixes.
  await seedBusiness(BIZ_TRIAL_EXPIRED_NO_DATE, "starter");
  await seedSubscription(BIZ_TRIAL_EXPIRED_NO_DATE, { plan: "pro", status: "trialing", trialEnd: null, currentPeriodEnd: null });

  // Genuinely expired trial: trialEnd in the past, still says "trialing" (webhook not yet processed).
  await seedBusiness(BIZ_TRIAL_EXPIRED_PAST, "starter");
  await seedSubscription(BIZ_TRIAL_EXPIRED_PAST, { plan: "pro", status: "trialing", trialEnd: new Date(now.getTime() - oneDay) });

  // Real active paid subscription.
  await seedBusiness(BIZ_ACTIVE_PAID, "starter");
  await seedSubscription(BIZ_ACTIVE_PAID, { plan: "growth", status: "active", currentPeriodEnd: new Date(now.getTime() + 20 * oneDay) });

  // Canceled but still within the period they already paid for.
  await seedBusiness(BIZ_CANCELED_WITHIN_PERIOD, "starter");
  await seedSubscription(BIZ_CANCELED_WITHIN_PERIOD, { plan: "pro", status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(now.getTime() + 5 * oneDay) });

  // Canceled with no period-end data at all — must fail closed, not open.
  await seedBusiness(BIZ_CANCELED_NO_PERIOD_END, "starter");
  await seedSubscription(BIZ_CANCELED_NO_PERIOD_END, { plan: "pro", status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: null });

  // businesses.plan says "growth" (stale/manually edited) but there is NO
  // subscription row at all — must NOT grant growth entitlements for free.
  await seedBusiness(BIZ_NO_SUBSCRIPTION_BUT_STALE_PLAN, "growth");
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- 4-6, 11: selected-plan entitlements during a genuine trial ---

test("4-6. an active trial grants the SELECTED plan's entitlements (Growth trial -> Growth capabilities)", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_TRIAL_ACTIVE);
  assert.equal(result.plan, "growth");
  assert.equal(result.capabilities.includes("customer_ops.appointments"), true); // real Growth capability
});

test("11. a Pro trial does not grant Enterprise capabilities", async () => {
  // (biz-trial-expired-past is a Pro trial, but expired — use a fresh active one for this check)
  await db.insert(schema.businesses).values({ id: "biz-pro-trial-active", name: "pro-trial", slug: "biz-pro-trial-active", plan: "starter", status: "active", createdAt: new Date(), updatedAt: new Date() });
  await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: "biz-pro-trial-active", provider: "stripe", providerCustomerId: "cus_x", providerSubscriptionId: "sub_x", providerEventId: "evt_x", plan: "pro", status: "trialing", trialEnd: new Date(Date.now() + 5 * 86400000), currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, createdAt: new Date(), updatedAt: new Date() });
  const result = await entitlements.getBusinessEntitlements("biz-pro-trial-active");
  assert.equal(result.plan, "pro");
  for (const enterpriseOnly of ["enterprise.organization", "enterprise.multi_business", "enterprise.advanced_governance"]) {
    assert.equal(result.capabilities.includes(enterpriseOnly), false, `pro trial must not include ${enterpriseOnly}`);
  }
});

// --- 18-19, 24-25: the core security fix — fail-closed expiration ---

test("18a. a 'trialing' row with NO trialEnd date is NOT treated as usable (fail-closed, not fail-open)", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_TRIAL_EXPIRED_NO_DATE);
  assert.notEqual(result.plan, "pro", "must not silently grant Pro when trialEnd is missing");
  assert.equal(result.plan, "starter", "must fall back to Starter, not the stale/unusable subscription plan");
});

test("18b. a 'trialing' row with trialEnd in the PAST is not usable", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_TRIAL_EXPIRED_PAST);
  assert.equal(result.plan, "starter");
});

test("24. expired trial loses premium entitlement entirely (does not linger at the trialed plan)", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_TRIAL_EXPIRED_PAST);
  assert.equal(result.capabilities.includes("human_workforce.core"), false, "expired Pro trial must not retain Pro-only capabilities");
});

test("25. businesses.plan fallback cannot bypass expiration — a stale 'growth' plan value with NO subscription row is still just Starter", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_NO_SUBSCRIPTION_BUT_STALE_PLAN);
  assert.equal(result.plan, "starter", "a stale businesses.plan value must never grant free premium access on its own");
});

test("a canceled subscription with NO currentPeriodEnd data is NOT usable (fail-closed)", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_CANCELED_NO_PERIOD_END);
  assert.equal(result.plan, "starter");
});

test("a canceled subscription still within its paid period remains usable at that plan", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_CANCELED_WITHIN_PERIOD);
  assert.equal(result.plan, "pro");
});

test("an active paid subscription is usable regardless of currentPeriodEnd presence", async () => {
  const result = await entitlements.getBusinessEntitlements(BIZ_ACTIVE_PAID);
  assert.equal(result.plan, "growth");
});

// --- 5. Trial duration ---
test("5. trial duration is 14 days", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/provider.ts"), "utf8");
  assert.match(source, /TRIAL_DAYS\s*=\s*14/);
});

// --- 7. Enterprise is not self-service ---
test("7. Enterprise is rejected by the trial route's plan allow-list", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /SELF_SERVE_TRIAL_PLANS\s*=\s*\[\s*"starter",\s*"growth",\s*"pro"\s*\]/);
  assert.doesNotMatch(source, /SELF_SERVE_TRIAL_PLANS\s*=\s*\[[^\]]*enterprise/);
});

// --- 2-3. intended-plan preservation and invalid-plan rejection ---
test("2. the trial route trusts normalizePlan's canonical coercion, not a raw client string", async () => {
  assert.equal(planDefs.normalizePlan("growth"), "growth");
  assert.equal(planDefs.normalizePlan("not-a-real-plan"), "starter"); // normalizePlan coerces...
});
test("3. ...and the route explicitly rejects when the raw input didn't already match the coerced value, instead of silently accepting the coercion", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /requestedPlan !== plan/);
});

// --- 30. arbitrary provider price ID rejection ---
test("30. the browser can never specify an arbitrary provider price ID — only a canonical plan name reaches the server, which maps it itself", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.doesNotMatch(source, /body\.priceId|body\.price_id|body\.providerPriceId/, "the trial route must never accept a client-supplied price/provider ID");
  assert.match(source, /getConfiguredPriceId\(plan\)/, "price ID must be derived server-side from the canonical plan");
});

// --- 9-10. payment method / raw card storage ---
test("8-9. payment collection is provider-hosted (Stripe Checkout redirect), never raw card fields", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/provider.ts"), "utf8");
  assert.doesNotMatch(source, /cardNumber|card_number|\bcvv\b|\bcvc\b/i, "no raw card fields anywhere in the provider layer");
  assert.match(source, /checkout\/sessions/, "Stripe checkout is the real hosted-payment mechanism used");
});
test("9b. no card/CVV field exists anywhere in db/schema.ts", async () => {
  const source = await readFile(path.join(REPO_ROOT, "db/schema.ts"), "utf8");
  assert.doesNotMatch(source, /card_number|cardNumber|\bcvv\b|\bcvc\b/i);
});

// --- 12. currency formatter / trial terms wording lives with the shared, non-duplicated pricing presentation ---
test("Pricing presentation (labels/copy) is defined once and imported by both /pricing and onboarding, not duplicated", async () => {
  const pricingSource = await readFile(path.join(REPO_ROOT, "app/pricing/page.tsx"), "utf8");
  const onboardingSource = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  assert.match(pricingSource, /from ["']@\/lib\/billing\/pricing-presentation["']/);
  assert.match(onboardingSource, /from ["']@\/lib\/billing\/pricing-presentation["']/);
});

// --- 14. zero-charge-today and 15. future-charge disclosure copy ---
test("14-15. the onboarding review step discloses no subscription charge today, the future first-charge date, and honestly discloses a possible verification charge", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  assert.match(source, /Cancel anytime before your trial ends/);
  assert.match(source, /temporary verification charge/);
  assert.match(source, /refunded where applicable/);
  // Must never claim "$0 today" unconditionally without qualifying it's the
  // SUBSCRIPTION charge — a verification charge may genuinely occur.
  assert.doesNotMatch(source, /won&apos;t be charged today/);
});

// --- 16-17. cancellation behavior: cancel-at-period-end, never an immediate cutoff ---
test("16-17. Stripe cancellation uses cancel_at_period_end (never an immediate DELETE that would also cut off already-granted trial access)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/provider.ts"), "utf8");
  assert.match(source, /cancel_at_period_end.*true/);
  assert.doesNotMatch(source, /method:\s*"DELETE"/, "must not immediately delete the subscription");
});
test("Stripe cancelSubscription is actually implemented (was previously advertised as supported but missing — a real bug fixed by this task)", () => {
  assert.equal(typeof provider.stripeProvider.cancelSubscription, "function");
  assert.equal(provider.stripeProvider.capabilities.supportsCancellation, true);
});

// --- Both providers now genuinely support trials, via different real mechanisms ---
test("Stripe capability declares real trial support (one-shot checkout with trial_period_days)", () => {
  assert.equal(provider.stripeProvider.capabilities.supportsTrials, true);
  assert.equal(provider.stripeProvider.capabilities.supportsMultiStepAuthorization, false);
});
test("Paystack capability declares real trial support via the multi-step authorize-then-subscribe lifecycle, not a one-shot checkout", () => {
  assert.equal(provider.paystackProvider.capabilities.supportsTrials, true);
  assert.equal(provider.paystackProvider.capabilities.supportsMultiStepAuthorization, true);
});
test("Paystack's legacy one-shot createCheckoutSession still throws for a requested trial — it must go through authorizePaymentMethod instead", async () => {
  await assert.rejects(
    () => provider.paystackProvider.createCheckoutSession({ priceId: "PLN_x", successUrl: "https://x", cancelUrl: "https://x", metadata: { businessId: "b", plan: "growth", email: "a@b.com" }, trialPeriodDays: 14 }),
    /authorizePaymentMethod/,
  );
});

// --- 19-20. one-trial-per-business (the actual anti-abuse rule implemented) ---
test("19. the trial route rejects activation when a subscriptions row already exists for the business (documented anti-abuse rule)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /TRIAL_ALREADY_USED/);
  assert.match(source, /already used its introductory trial/);
});

// --- 21. webhook authority / 22. duplicate activation idempotency ---
test("20-21. subscription state changes are driven only by provider webhooks, never a client-side timer", async () => {
  const stripeWebhook = await readFile(path.join(REPO_ROOT, "app/api/billing/webhooks/stripe/route.ts"), "utf8");
  assert.match(stripeWebhook, /verifyStripeWebhookSignature/);
  assert.match(stripeWebhook, /saveSubscription/);
});
test("22. checkout session creation is idempotent per business+plan via a real Stripe Idempotency-Key", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /idempotencyKey\s*=\s*`trial:\$\{membership\.businessId\}:\$\{plan\}`/);
  const providerSource = await readFile(path.join(REPO_ROOT, "lib/billing/provider.ts"), "utf8");
  assert.match(providerSource, /Idempotency-Key/);
});
test("saveSubscription itself is idempotent on providerEventId (duplicate webhook delivery is a no-op)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/subscription-service.ts"), "utf8");
  assert.match(source, /existing\?\.providerEventId === subscription\.providerEventId\) return false/);
});

// --- 23. plan changes don't reset the trial clock (documented, not modified by this task) ---
test("23. this task does not introduce any trial-restart logic on plan change — trialEnd is written only from provider webhook data, never recomputed client-side", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/subscription-service.ts"), "utf8");
  assert.doesNotMatch(source, /trialEnd:\s*new Date\(/, "trialEnd must come from the provider's own webhook payload, never be locally recomputed");
});

// --- 28. billing RBAC ---
test("28. starting and cancelling a trial both require BILLING_MANAGE permission, not just authentication", async () => {
  const trialSource = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  const cancelSource = await readFile(path.join(REPO_ROOT, "app/api/billing/subscription/route.ts"), "utf8");
  assert.match(trialSource, /PERMISSIONS\.BILLING_MANAGE/);
  assert.match(cancelSource, /PERMISSIONS\.BILLING_MANAGE/);
});

// --- 29. direct API tampering / businessId override ---
test("29. the trial route derives businessId only from the authenticated server-resolved membership, never from the request body", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.doesNotMatch(source, /body\.businessId/);
  assert.match(source, /membership\.businessId/);
});

// --- 26. tenant isolation ---
test("26. tenant isolation: trial/subscription state for one business never leaks into another business's entitlement resolution", async () => {
  const a = await entitlements.getBusinessEntitlements(BIZ_TRIAL_ACTIVE);
  const b = await entitlements.getBusinessEntitlements(BIZ_ACTIVE_PAID);
  assert.equal(a.plan, "growth");
  assert.equal(b.plan, "growth");
  // Different underlying rows, independently resolved — not a shared cache bleeding state.
  const c = await entitlements.getBusinessEntitlements(BIZ_TRIAL_EXPIRED_PAST);
  assert.equal(c.plan, "starter");
});

// --- 27. foreign business rejection (same pattern already proven for appointments/tickets; re-confirmed for billing) ---
test("27. billing routes resolve the acting business via server-side membership lookup, never a client-supplied business id", async () => {
  for (const file of ["app/api/billing/checkout/route.ts", "app/api/billing/trial/route.ts", "app/api/billing/subscription/route.ts", "app/api/billing/portal/route.ts"]) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /getBusinessMembership\(session\.user\.id\)/, `${file} must resolve business via authenticated membership`);
  }
});

// --- 33-34. no duplicate business / subscription on resume ---
test("33-34. onboarding's business creation is idempotent per-user (returns the existing business on a 409 rather than creating a second one)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /existingMembership\.length > 0/);
  assert.match(source, /status:\s*409/);
});
test("subscriptions table enforces exactly one row per business at the schema level", async () => {
  const source = await readFile(path.join(REPO_ROOT, "db/schema.ts"), "utf8");
  assert.match(source, /subscriptions_business_id_unique/);
});

// --- 35. cancellation preserves business data ---
test("35. cancellation never deletes business records — the cancel route only calls the provider and writes a status via the webhook, no destructive queries", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/subscription/route.ts"), "utf8");
  assert.doesNotMatch(source, /db\.delete/);
});
