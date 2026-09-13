// Static policy checks for the complimentary/internal-account grant
// mechanism (app/api/admin/businesses/[id]/route.ts extended, not
// duplicated) and the billing UI's truthful representation of it. Mirrors
// this repo's established *-policy.test.mjs idiom (source-string assertions
// against the actual shipped files) since fully exercising the admin route
// requires a real authenticated platform-admin session — the underlying
// entitlement-resolution behavior this mechanism depends on is covered
// end-to-end against a real database in
// tests/complimentary-plan-integration.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ADMIN_ROUTE = "app/api/admin/businesses/[id]/route.ts";
const BILLING_PAGE = "app/dashboard/billing/page.tsx";
const ADMIN_UI = 'app/admin/businesses/[id]/page.tsx';

const [adminRoute, billingPage, adminUi] = await Promise.all(
  [ADMIN_ROUTE, BILLING_PAGE, ADMIN_UI].map((file) => readFile(file, "utf8")),
);

// --- 1. The admin route remains platform-admin-gated and audited ---

test("the admin business route still requires isPlatformAdmin and a non-empty reason before any plan change", () => {
  assert.match(adminRoute, /isPlatformAdmin\(/);
  assert.match(adminRoute, /if \(!reason\) return NextResponse\.json/);
});

test("granting a plan (complimentary or not) always writes an audit log capturing who, when (implicit createdAt), the reason, and the resulting plan/status", () => {
  const planBranch = adminRoute.slice(adminRoute.indexOf('action === "plan"'), adminRoute.indexOf('if (action === "trial"'));
  assert.match(planBranch, /createAuditLog\(/);
  assert.match(planBranch, /userId:\s*value\.session\.user\.id/);
  assert.match(planBranch, /description:\s*reason/);
  assert.match(planBranch, /metadata:\s*\{\s*plan,\s*status,\s*complimentary\s*\}/);
});

// --- 2. Complimentary is a genuinely distinct, truthful status ---

test("a complimentary grant sets status to the honest 'complimentary' literal, never disguised as 'active'", () => {
  const planBranch = adminRoute.slice(adminRoute.indexOf('action === "plan"'), adminRoute.indexOf('if (action === "trial"'));
  assert.match(planBranch, /complimentary\s*\?\s*"complimentary"\s*:\s*"active"/);
});

test("complimentary is rejected for the enterprise plan (enterprise already has its own truthful enterprise_contract status)", () => {
  const planBranch = adminRoute.slice(adminRoute.indexOf('action === "plan"'), adminRoute.indexOf('if (action === "trial"'));
  assert.match(planBranch, /complimentary && plan === "enterprise"/);
});

test("every plan grant via this action uses provider \"internal\", never fabricating a Paystack/Stripe-looking record", () => {
  const planBranch = adminRoute.slice(adminRoute.indexOf('action === "plan"'), adminRoute.indexOf('if (action === "trial"'));
  assert.match(planBranch, /provider:\s*"internal"/);
});

test("converting an existing subscription via this action clears stale provider IDs and period/trial dates, so no fake renewal date survives the conversion", () => {
  const planBranch = adminRoute.slice(adminRoute.indexOf('action === "plan"'), adminRoute.indexOf('if (action === "trial"'));
  const updateCall = planBranch.slice(planBranch.indexOf("if (current)"), planBranch.indexOf("else await db.insert"));
  assert.match(updateCall, /providerCustomerId:\s*null/);
  assert.match(updateCall, /providerSubscriptionId:\s*null/);
  assert.match(updateCall, /currentPeriodEnd:\s*null/);
  assert.match(updateCall, /trialEnd:\s*null/);
});

test("a Stripe-managed subscription cannot be silently converted to complimentary through this action", () => {
  const planBranch = adminRoute.slice(adminRoute.indexOf('action === "plan"'), adminRoute.indexOf('if (action === "trial"'));
  assert.match(planBranch, /current\?\.provider === "stripe" && current\.providerSubscriptionId/);
});

// --- 3. lib/billing/entitlements.ts treats complimentary as usable, matching the same class as active/enterprise_contract ---

test("entitlements.ts documents and implements complimentary as usable without a date check", async () => {
  const source = await readFile("lib/billing/entitlements.ts", "utf8");
  assert.match(source, /current\.status === "active" \|\| current\.status === "enterprise_contract" \|\| current\.status === "complimentary"/);
});

// --- 4. Billing UI never shows a fake price, renewal date, or cancel/manage-billing action for a complimentary account ---

test("the billing page shows 'Complimentary' instead of a real price for a complimentary subscription", () => {
  assert.match(billingPage, /isComplimentary\s*=\s*data\.subscription\?\.status === "complimentary"/);
  assert.match(billingPage, /isComplimentary \? "Complimentary"/);
});

test("the billing page never shows a renewal date for a complimentary subscription", () => {
  assert.match(billingPage, /isComplimentary \? "No billing — complimentary account"/);
});

test("the billing page hides Manage billing / Cancel subscription actions for a complimentary account (nothing real to manage or cancel)", () => {
  assert.match(billingPage, /!isComplimentary && data\.capabilities\.supportsBillingPortal/);
  assert.match(billingPage, /!isComplimentary && data\.capabilities\.supportsCancellation/);
});

test("the billing page's provider label recognizes 'internal' rather than showing a raw/undefined string", () => {
  assert.match(billingPage, /internal:\s*"Internal"/);
});

// --- 5. The admin UI actually exposes a way to use this mechanism (not API-only/undiscoverable) ---

test("the admin business detail page has a working 'grant plan' control wired to action: 'plan' with a complimentary checkbox", () => {
  assert.match(adminUi, /action:\s*"plan"/);
  assert.match(adminUi, /complimentary/);
  assert.match(adminUi, /reason\.trim\(\)/, "must still require a reason client-side too, matching the server-side requirement");
});

test("the admin UI disables the complimentary checkbox for Enterprise (matches the server-side rejection)", () => {
  assert.match(adminUi, /disabled=\{grantPlan === "enterprise"\}/);
});
