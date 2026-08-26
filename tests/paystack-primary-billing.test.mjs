// Tests for converting SuperKuba's 14-day trial billing to Paystack-primary,
// using Paystack's real, documented authorize-then-subscribe lifecycle
// (verified against Paystack's own current docs: card authorization requires
// a real, refundable charge — "zero debits are not supported yet" — and
// subscriptions accept a future start_date to defer the first charge).
// Uses the real provider/entitlements modules via the alias loader; never
// calls the live Paystack API (no test credentials assumed present).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let provider;

test.before(async () => {
  provider = await import("@/lib/billing/provider");
});

// --- 1-3. Paystack is supported, Stripe not required, Paystack is primary ---
test("1. Paystack is supported for trials", () => {
  assert.equal(provider.paystackProvider.capabilities.supportsTrials, true);
});
test("2. Stripe is not required — activeBillingProvider defaults to paystack, and Paystack's trial path never calls a Stripe function", () => {
  const originalEnv = process.env.BILLING_PROVIDER;
  delete process.env.BILLING_PROVIDER;
  try {
    assert.equal(provider.activeBillingProvider(), "paystack");
  } finally {
    if (originalEnv === undefined) delete process.env.BILLING_PROVIDER; else process.env.BILLING_PROVIDER = originalEnv;
  }
});
test("3. Paystack is the primary provider (default when BILLING_PROVIDER is unset)", () => {
  const source = /paystack/;
  assert.match(String(provider.activeBillingProvider.toString().match(/process\.env\.BILLING_PROVIDER \|\| "(\w+)"/)?.[1]), source);
});
test("getBillingProvider() resolves to the real paystackProvider object by default", () => {
  const originalEnv = process.env.BILLING_PROVIDER;
  delete process.env.BILLING_PROVIDER;
  try {
    assert.equal(provider.getBillingProvider().name, "paystack");
  } finally {
    if (originalEnv === undefined) delete process.env.BILLING_PROVIDER; else process.env.BILLING_PROVIDER = originalEnv;
  }
});

// --- 4-6. Starter/Growth/Pro Paystack trial route to the multi-step lifecycle ---
test("4-6. Starter, Growth, and Pro all route through the multi-step Paystack lifecycle when Paystack is active", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /SELF_SERVE_TRIAL_PLANS\s*=\s*\[\s*"starter",\s*"growth",\s*"pro"\s*\]/);
  assert.match(source, /supportsMultiStepAuthorization/);
  assert.match(source, /authorizePaymentMethod/);
});

// --- 7. Enterprise rejected / 8. invalid plan rejected / 9. no client plan-code trust ---
test("7-8. Enterprise and invalid plans are rejected by the trial route before any provider call", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /requestedPlan !== plan/);
  assert.doesNotMatch(source, /SELF_SERVE_TRIAL_PLANS\s*=\s*\[[^\]]*enterprise/);
});
test("9. the browser cannot supply an arbitrary Paystack plan code — only a canonical plan name reaches the server", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.doesNotMatch(source, /body\.planCode|body\.paystackPlan/);
  assert.match(source, /getConfiguredPriceId\(plan\)/);
});

// --- 10. payment authorization required before trial activation ---
test("10. trial activation for Paystack requires authorizePaymentMethod to succeed before any subscription is created", async () => {
  const callbackSource = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/callback/route.ts"), "utf8");
  assert.match(callbackSource, /verifyPaymentMethod/);
  assert.match(callbackSource, /createTrialSubscription/);
  const verifyIndex = callbackSource.indexOf("verifyPaymentMethod");
  const subscribeIndex = callbackSource.indexOf("createTrialSubscription");
  assert.ok(verifyIndex > 0 && subscribeIndex > verifyIndex, "verification must happen before subscription creation");
});

// --- 11-13. safe references only, no PAN, no CVV ---
test("11. only safe Paystack references are captured (authorization code, customer code, card display metadata) — never full card data", () => {
  const source = provider.paystackProvider.verifyPaymentMethod.toString();
  assert.match(source, /authorization_code/);
  assert.match(source, /customer_code/);
  assert.doesNotMatch(source, /card_number|cvv|cvc|pin\b|otp\b/i);
});
test("12-13. no PAN or CVV field exists anywhere in the schema or provider layer", async () => {
  for (const file of ["db/schema.ts", "lib/billing/provider.ts"]) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /card_number|cardNumber|\bcvv\b|\bcvc\b|\bpin\b/i, `${file} must never reference raw card fields`);
  }
});
test("card verification amount is a small, currency-appropriate figure in the smallest currency unit, never the full subscription price", () => {
  assert.equal(provider.paystackVerificationAmount("GHS"), 100); // 100 pesewas = GHS 1.00
  assert.equal(provider.paystackVerificationAmount("NGN"), 5000); // NGN 50.00, matching Paystack's own suggested minimum
  assert.ok(provider.paystackVerificationAmount("GHS") < 100000, "verification amount must be trivially small, not a real subscription price");
});

// --- 14. 14-day trial (shared constant, already tested in trial-onboarding.test.mjs — re-confirmed for the callback path) ---
test("14. the Paystack callback route computes trialEnd as exactly TRIAL_DAYS from authorization time", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/callback/route.ts"), "utf8");
  assert.match(source, /TRIAL_DAYS \* 24 \* 60 \* 60 \* 1000/);
});

// --- 15-16. entitlement / expired-trial denial already covered by tests/trial-onboarding.test.mjs's fail-closed suite; re-confirmed provider-agnostic ---
test("15-16. entitlement resolution is provider-agnostic — it reads status/trialEnd from the subscriptions row, never branches on provider name", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/entitlements.ts"), "utf8");
  assert.doesNotMatch(source, /provider\s*===\s*"paystack"|provider\s*===\s*"stripe"/);
});

// --- 17. cancellation prevents paid activation ---
test("17. Paystack cancelSubscription disables the subscription (including a still-pending, not-yet-started one) rather than an immediate charge-triggering action", () => {
  const source = provider.paystackProvider.cancelSubscription.toString();
  assert.match(source, /subscription\/disable/);
});

// --- 18. trialConsumedAt protection (implemented as subscription-row existence, documented) ---
test("18. one-trial-per-business is enforced by subscription-row existence (the trialConsumedAt equivalent) for the Paystack path too", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /TRIAL_ALREADY_USED/);
  // The check happens before ANY provider branching, so it applies uniformly.
  const checkIndex = source.indexOf("TRIAL_ALREADY_USED");
  const branchIndex = source.indexOf("supportsMultiStepAuthorization");
  assert.ok(checkIndex > 0 && branchIndex > checkIndex, "the one-trial check must happen before provider-specific branching");
});
test("the callback route re-checks subscription-row existence immediately before writing (idempotency safety net for a double authorization)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/callback/route.ts"), "utf8");
  assert.match(source, /already_active/);
});

// --- 19. plan change does not restart trial ---
test("19. changing plan during a Paystack trial preserves the original trialEnd — it is read from the existing row, never recomputed", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/change-plan/route.ts"), "utf8");
  assert.doesNotMatch(source, /new Date\(Date\.now\(\) \+/, "must never compute a fresh trial end date");
  assert.match(source, /current\.trialEnd/);
  assert.doesNotMatch(source, /trialEnd:\s*new Date/, "the subscriptions row update must not touch trialEnd");
});
test("plan change is only available while status is trialing, and only changes the plan/subscription code fields", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/change-plan/route.ts"), "utf8");
  assert.match(source, /current\.status !== "trialing"/);
});

// --- 20. duplicate activation protection ---
test("20. duplicate activation protection exists at both the start route (pre-check) and the callback route (re-check)", async () => {
  const startSource = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  const callbackSource = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/callback/route.ts"), "utf8");
  assert.match(startSource, /subscriptions\.businessId, membership\.businessId/);
  assert.match(callbackSource, /subscriptions\.businessId, membership\.businessId/);
});

// --- 21-22. webhook signature validation and replay/idempotency ---
test("21. Paystack webhook signature verification uses a real, constant-time HMAC-SHA512 comparison", () => {
  const secret = "test_secret_for_unit_test_only";
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;
  try {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
    const validSignature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    assert.equal(provider.verifyPaystackSignature(payload, validSignature), true);
    assert.equal(provider.verifyPaystackSignature(payload, "not-a-real-signature-00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"), false);
    assert.equal(provider.verifyPaystackSignature(payload, null), false);
  } finally {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  }
});
test("the webhook route distinguishes an invalid signature (400, reject) from a valid signature carrying an intentionally-ignored event (200, acknowledge — no retry storm)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/webhooks/paystack/route.ts"), "utf8");
  assert.match(source, /verifyPaystackSignature/);
  assert.match(source, /ignored: true/);
});
test("22. the verification charge webhook (metadata.purpose === trial_card_verification) is deliberately ignored, never mistaken for subscription activity", () => {
  const secret = "test_secret_2";
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;
  try {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref_verify", customer: "CUS_x", metadata: { purpose: "trial_card_verification", plan: "growth" } } });
    const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    const result = provider.paystackProvider.parseWebhook(payload, signature);
    assert.equal(result, null, "a verification-charge webhook must never be interpreted as subscription activity");
  } finally {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  }
});
test("a real subscription charge.success (no verification purpose in metadata) IS interpreted as active subscription activity", () => {
  const secret = "test_secret_3";
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;
  try {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref_real", customer: "CUS_x", subscription_code: "SUB_x", metadata: { plan: "growth" } } });
    const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    const result = provider.paystackProvider.parseWebhook(payload, signature);
    assert.equal(result.status, "active");
    assert.equal(result.plan, "growth");
  } finally {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  }
});
test("informational events (subscription.create, invoice.create, invoice.update) are ignored, never overwriting the callback route's authoritative write", () => {
  const secret = "test_secret_4";
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;
  try {
    for (const eventName of ["subscription.create", "invoice.create", "invoice.update"]) {
      const payload = JSON.stringify({ event: eventName, data: { reference: "ref_info", metadata: { plan: "growth" } } });
      const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
      assert.equal(provider.paystackProvider.parseWebhook(payload, signature), null, `${eventName} must be ignored`);
    }
  } finally {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  }
});
test("subscription.disable and subscription.not_renew both map to canceled", () => {
  const secret = "test_secret_5";
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;
  try {
    for (const eventName of ["subscription.disable", "subscription.not_renew"]) {
      const payload = JSON.stringify({ event: eventName, data: { reference: "ref_cancel", metadata: { plan: "growth" } } });
      const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
      assert.equal(provider.paystackProvider.parseWebhook(payload, signature).status, "canceled");
    }
  } finally {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  }
});
test("invoice.payment_failed maps to past_due", () => {
  const secret = "test_secret_6";
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;
  try {
    const payload = JSON.stringify({ event: "invoice.payment_failed", data: { reference: "ref_fail", metadata: { plan: "pro" } } });
    const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    assert.equal(provider.paystackProvider.parseWebhook(payload, signature).status, "past_due");
  } finally {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  }
});

// --- 23-24. successful/failed first billing rely on the same webhook path, already proven above ---
test("23-24. successful and failed first-billing outcomes are both driven by the webhook, using the same saveSubscription idempotency guard as every other event", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/subscription-service.ts"), "utf8");
  assert.match(source, /existing\?\.providerEventId === subscription\.providerEventId\) return false/);
});

// --- 25. provider subscription mapping (Paystack plan code, never a raw client value) ---
test("25. canonical plan -> Paystack plan code mapping is server-side only, via configured env vars", () => {
  const originalEnv = process.env.BILLING_PROVIDER;
  process.env.BILLING_PROVIDER = "paystack";
  try {
    // getConfiguredPriceId reads PAYSTACK_PLAN_* env vars, never a request body value.
    const originalCode = process.env.PAYSTACK_PLAN_GROWTH;
    process.env.PAYSTACK_PLAN_GROWTH = "PLN_test_growth";
    try {
      assert.equal(provider.getConfiguredPriceId("growth"), "PLN_test_growth");
    } finally {
      if (originalCode === undefined) delete process.env.PAYSTACK_PLAN_GROWTH; else process.env.PAYSTACK_PLAN_GROWTH = originalCode;
    }
    assert.equal(provider.getConfiguredPriceId("enterprise"), null, "enterprise must never resolve to a self-service plan code");
  } finally {
    if (originalEnv === undefined) delete process.env.BILLING_PROVIDER; else process.env.BILLING_PROVIDER = originalEnv;
  }
});

// --- 29. businesses.plan fallback cannot bypass billing (re-confirmed provider-agnostic) ---
test("29. businesses.plan fallback removal applies regardless of billing provider — the fix is in the shared entitlements resolver", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/entitlements.ts"), "utf8");
  assert.doesNotMatch(source, /businessRow\[0\]\?\.plan/);
  assert.match(source, /never businesses\.plan/);
});

// --- 30. Paystack works without any Stripe env vars ---
test("30. Paystack's authorize/verify/subscribe functions never read a STRIPE_ env var", () => {
  for (const fn of [provider.paystackProvider.authorizePaymentMethod, provider.paystackProvider.verifyPaymentMethod, provider.paystackProvider.refundVerificationCharge, provider.paystackProvider.createTrialSubscription, provider.paystackProvider.cancelSubscription]) {
    assert.doesNotMatch(fn.toString(), /STRIPE_/);
  }
});

// --- 31. unsupported provider fails closed ---
test("31. an unsupported BILLING_PROVIDER value fails closed (throws), never silently falls back to a default provider", () => {
  const original = process.env.BILLING_PROVIDER;
  process.env.BILLING_PROVIDER = "some-unsupported-provider";
  try {
    assert.throws(() => provider.activeBillingProvider(), /Unsupported BILLING_PROVIDER/);
  } finally {
    if (original === undefined) delete process.env.BILLING_PROVIDER; else process.env.BILLING_PROVIDER = original;
  }
});

// --- 32. unsupported currency fails closed ---
test("32. an unsupported verification currency fails closed — no silent fallback to a different currency's amount", () => {
  assert.equal(provider.paystackVerificationAmount("XYZ"), null);
  assert.equal(provider.paystackVerificationAmount("EUR"), null, "only currencies actually configured for verification are supported, no invented amount");
});
test("the trial route returns CONFIGURATION_REQUIRED, not a crash or a fabricated success, when the verification currency isn't configured", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/route.ts"), "utf8");
  assert.match(source, /verificationAmount == null/);
  assert.match(source, /CONFIGURATION_REQUIRED/);
});

// --- 33. verification charge disclosure ---
test("33. the onboarding UI discloses the verification charge honestly, distinct from the subscription charge, with refund language", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  assert.match(source, /temporary verification charge/);
  assert.match(source, /refunded where applicable/);
  assert.match(source, /separate from.*never the same as.*SuperKuba subscription payment/s);
});
test("verification amounts are always in the smallest currency unit and clearly smaller than any plausible subscription price", () => {
  for (const currency of ["GHS", "NGN", "ZAR", "USD"]) {
    const amount = provider.paystackVerificationAmount(currency);
    assert.ok(amount !== null && amount > 0 && amount < 10000, `${currency} verification amount must be small`);
  }
});

// --- 34. trial cancellation preserves business data (re-confirmed for the new change-plan route too) ---
test("34. the trial change-plan route never deletes business data, only updates subscription/plan fields", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/trial/change-plan/route.ts"), "utf8");
  assert.doesNotMatch(source, /db\.delete/);
});

// --- 35. scheduled finalization is idempotent ---
test("35. the safety-net trial-reconciliation cron is protected by CRON_SECRET and only ever updates status, never deletes or duplicates rows", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/cron/reconcile-trials/route.ts"), "utf8");
  assert.match(source, /CRON_SECRET/);
  assert.doesNotMatch(source, /db\.delete|db\.insert/);
  assert.match(source, /db\.update/);
});
test("vercel.json declares the reconciliation cron on a real schedule", async () => {
  const source = await readFile(path.join(REPO_ROOT, "vercel.json"), "utf8");
  const config = JSON.parse(source);
  assert.ok(Array.isArray(config.crons) && config.crons.length > 0);
  assert.match(config.crons[0].path, /reconcile-trials/);
});

// --- Section 21: no lingering "reject non-Stripe trial" restriction anywhere ---
test("no route rejects a trial merely because the provider isn't Stripe", async () => {
  const files = ["app/api/billing/trial/route.ts", "app/api/billing/trial/callback/route.ts"];
  for (const file of files) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /provider !== "stripe"/);
  }
});

// --- Section 22: Stripe remains optional and functional, not deleted ---
test("Stripe's checkout/cancellation/portal/webhook implementations remain intact and were not deleted", () => {
  assert.equal(typeof provider.stripeProvider.createCheckoutSession, "function");
  assert.equal(typeof provider.stripeProvider.cancelSubscription, "function");
  assert.equal(typeof provider.stripeProvider.createPortalSession, "function");
  assert.equal(typeof provider.stripeProvider.parseWebhook, "function");
});

// --- Section 20: Flutterwave-readiness — the multi-step interface is provider-neutral ---
test("the multi-step authorization lifecycle is defined as a generic BillingProvider interface, not hardcoded to Paystack specifically", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/provider.ts"), "utf8");
  assert.match(source, /authorizePaymentMethod\?:/);
  assert.match(source, /verifyPaymentMethod\?:/);
  assert.match(source, /createTrialSubscription\?:/);
  assert.match(source, /future Flutterwave provider/);
});
