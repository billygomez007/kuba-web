// Canonical plan/pricing architecture pass (2026-09): locks in the approved
// Starter/Growth/Pro/Enterprise commercial matrix. Most of the underlying
// entitlement machinery already existed and is already exhaustively tested
// (see tests/ai-workforce-policy-model.test.mjs for the full employee
// activation matrix, tests/entitlements-policy.test.mjs and
// tests/customer-operations-integration.test.mjs for the capability tier
// ladder). This file covers what's genuinely new in this pass: the real
// working prices/taglines, the visible/entitled/usageAvailable decomposition
// helper, and eliminating duplicated pricing copy across billing surfaces.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// These lib modules import their siblings without file extensions (the
// repo's normal style, resolved by bundlers automatically); this loader
// teaches plain Node ESM to resolve those the same way (matches
// tests/ai-workforce-policy-model.test.mjs's own pattern).
register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const { getPlanDefinition, planOrder, getPlanLimits } = await import("../lib/billing/plan-definitions.ts");
const { pricingCopy } = await import("../lib/billing/pricing-presentation.ts");
const { getEmployeeAccessState } = await import("../lib/billing/ai-workforce-policy.ts");

// --- 1. Canonical plan catalog: order, prices, positioning ---

test("all four canonical plans exist in the approved upgrade order", () => {
  assert.deepEqual(planOrder, ["starter", "growth", "pro", "enterprise"]);
});

test("approved working prices are exact", () => {
  assert.equal(pricingCopy.starter.price, "GHS 699");
  assert.equal(pricingCopy.growth.price, "GHS 1,999");
  assert.equal(pricingCopy.pro.price, "GHS 4,999");
  assert.equal(pricingCopy.enterprise.price, "Custom");
  for (const planId of ["starter", "growth", "pro"]) {
    assert.equal(pricingCopy[planId].billingLabel, "/ month");
  }
});

test("approved positioning headlines are exact", () => {
  assert.equal(pricingCopy.starter.tagline, "Your first AI employee");
  assert.equal(pricingCopy.growth.tagline, "Your AI customer and sales team");
  assert.equal(pricingCopy.pro.tagline, "Your complete AI workforce");
  assert.equal(pricingCopy.enterprise.tagline, "Your AI operating infrastructure");
});

test("Pro is marked recommended/flagship; no other plan is", () => {
  assert.equal(pricingCopy.pro.recommended, true);
  for (const planId of ["starter", "growth", "enterprise"]) {
    assert.equal(pricingCopy[planId].recommended, undefined);
  }
});

// --- 2. Approved active-employee-limit direction (section 31: no invented numbers) ---

test("active-employee limits match the only approved direction: Starter 1, Growth up to 3, Pro all standard (uncapped by count), Enterprise unlimited", () => {
  assert.equal(getPlanLimits(getPlanDefinition("starter")).employeeLimit, 1);
  assert.equal(getPlanLimits(getPlanDefinition("growth")).employeeLimit, 3);
  assert.equal(getPlanLimits(getPlanDefinition("pro")).employeeLimit, 10, "Pro's limit must exceed the 5 currently-implemented standard types so it never actually constrains them");
  assert.equal(getPlanLimits(getPlanDefinition("enterprise")).employeeLimit, null, "Enterprise must be unlimited (null), never an arbitrary large integer");
});

// --- 3. getEmployeeAccessState: the visible/entitled/usageAvailable decomposition ---

function entitlementsFor(planId) {
  const plan = getPlanDefinition(planId);
  return { plan: plan.id, planName: plan.name, capabilities: plan.capabilities, limits: { max_ai_employees: plan.employeeLimit, max_human_users: null, max_businesses: null, max_branches: null, max_knowledge_sources: null, max_automations: plan.automationLimit, max_api_keys: null, max_monthly_conversations: null, max_storage_mb: null, includedVoiceMinutes: plan.includedVoiceMinutes }, modules: [] };
}

test("getEmployeeAccessState: always visible regardless of entitlement (catalog discoverability is unconditional)", () => {
  const state = getEmployeeAccessState(entitlementsFor("starter"), "outreach", 0);
  assert.equal(state.visible, true);
  assert.equal(state.entitled, false);
});

test("getEmployeeAccessState: entitled+implemented+usage available on Starter for Receptionist with an empty slot", () => {
  const state = getEmployeeAccessState(entitlementsFor("starter"), "receptionist", 0);
  assert.equal(state.entitled, true);
  assert.equal(state.implemented, true);
  assert.equal(state.usageAvailable, true);
  assert.equal(state.requiredPlan, undefined);
});

test("getEmployeeAccessState: entitled+implemented but usage NOT available once Starter's single slot is full", () => {
  const state = getEmployeeAccessState(entitlementsFor("starter"), "receptionist", 1);
  assert.equal(state.entitled, true);
  assert.equal(state.usageAvailable, false, "this is the distinct exhausted-usage case, not a commercial-entitlement failure");
});

test("getEmployeeAccessState: not entitled surfaces the correct requiredPlan (Sales on Starter -> growth)", () => {
  const state = getEmployeeAccessState(entitlementsFor("starter"), "sales", 0);
  assert.equal(state.entitled, false);
  assert.equal(state.requiredPlan, "growth");
  assert.equal(state.usageAvailable, true, "not-entitled must not be conflated with usage-exhausted");
});

test("getEmployeeAccessState: implemented=false for a commercially-included-but-not-built type (Marketing on Pro)", () => {
  const state = getEmployeeAccessState(entitlementsFor("pro"), "marketing", 0);
  assert.equal(state.entitled, true, "Marketing IS commercially part of Pro");
  assert.equal(state.implemented, false, "but has no real runtime yet — never conflate the two dimensions");
});

test("getEmployeeAccessState: all five standard employees are entitled+implemented+usage-available on Pro with room to spare", () => {
  for (const type of ["receptionist", "sales", "customer-support", "outreach", "general-manager"]) {
    const state = getEmployeeAccessState(entitlementsFor("pro"), type, 0);
    assert.equal(state.entitled, true, `${type} should be entitled on Pro`);
    assert.equal(state.implemented, true, `${type} should be implemented`);
    assert.equal(state.usageAvailable, true, `${type} should have room on an empty Pro workspace`);
  }
});

// --- 4. Campaign Engine entitlement (Pro + Enterprise only) — cross-check against the real policy, not re-derived ---

test("outreach.campaigns is entitled starting at Pro, matching Kuba Outreach's own employee-type gate", () => {
  assert.equal(getPlanDefinition("starter").capabilities.includes("outreach.campaigns"), false);
  assert.equal(getPlanDefinition("growth").capabilities.includes("outreach.campaigns"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("outreach.campaigns"), true);
  assert.equal(getPlanDefinition("enterprise").capabilities.includes("outreach.campaigns"), true);
});

// --- 5. No duplicated pricing objects (section 16) ---

test("the dashboard billing plan-comparison page consumes the canonical pricingCopy, not its own hand-written price/tagline copy", async () => {
  const source = await readFile(new URL("../app/dashboard/billing/plans/PlansExperience.tsx", import.meta.url), "utf8");
  assert.match(source, /from ["']@\/lib\/billing\/pricing-presentation["']/);
  assert.match(source, /pricingCopy\[plan\.id\]/);
  assert.doesNotMatch(source, /No price is displayed until configured/, "must not still claim no price is configured now that real prices are approved");
  assert.doesNotMatch(source, /planDescriptions/, "must not keep a second hand-written positioning-copy object alongside pricingCopy");
});

test("the billing settings page shows the real current-plan price via the canonical pricingCopy, not a placeholder string", async () => {
  const source = await readFile(new URL("../app/dashboard/billing/page.tsx", import.meta.url), "utf8");
  assert.match(source, /from ["']@\/lib\/billing\/pricing-presentation["']/);
  assert.match(source, /pricingCopy\[data\.plan\.id\]/);
  assert.doesNotMatch(source, /placeholder pricing/i);
});

test("the public pricing page's placeholder-pricing disclaimer is gone now that prices are approved working configuration", async () => {
  const source = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /placeholders until final commercial pricing/);
});

// --- 6. Enriched upgrade CTA reuses the existing AI-employee catalog copy, not invented text (section 18) ---

test("the campaign-engine upgrade screen reuses Kuba Outreach's own catalog name/description/capabilities, not hand-invented marketing copy", async () => {
  const source = await readFile(new URL("../app/dashboard/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /from ["']@\/lib\/billing\/ai-workforce-catalog["']/);
  assert.match(source, /capabilityEmployeeType/);
  assert.match(source, /"outreach\.campaigns":\s*"outreach"/);
  assert.match(source, /capabilityUpgradeCopy/);
});
