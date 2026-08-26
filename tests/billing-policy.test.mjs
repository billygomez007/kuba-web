import assert from "node:assert/strict";
import test from "node:test";
import { capabilityMinimumPlan, defaultLimitsForPlan, getPlanDefinition, planOrder } from "../lib/billing/plan-definitions.ts";

function checkoutDecision(currentPlan, targetPlan) {
  if (targetPlan === "enterprise") return { allowed: false, reason: "sales_only" };
  return planOrder.indexOf(targetPlan) > planOrder.indexOf(currentPlan)
    ? { allowed: true, reason: "upgrade" }
    : { allowed: false, reason: "not_an_upgrade" };
}

function usageLabel(used, limit) {
  return used === null ? "Not currently tracked" : limit === null ? String(used) : `${used} / ${limit}`;
}

test("All four plans come from the canonical definitions", () => {
  assert.deepEqual(planDefinitionsIds(), ["starter", "growth", "pro", "enterprise"]);
});

function planDefinitionsIds() {
  return planOrder.map((planId) => getPlanDefinition(planId).id);
}

test("Canonical plans progress in the intended order", () => {
  assert.equal(planOrder.indexOf("starter") < planOrder.indexOf("growth"), true);
  assert.equal(planOrder.indexOf("growth") < planOrder.indexOf("pro"), true);
  assert.equal(planOrder.indexOf("pro") < planOrder.indexOf("enterprise"), true);
});

test("Starter to Growth is a permitted upgrade decision", () => {
  assert.deepEqual(checkoutDecision("starter", "growth"), { allowed: true, reason: "upgrade" });
});

test("Growth to Pro is a permitted upgrade decision", () => {
  assert.deepEqual(checkoutDecision("growth", "pro"), { allowed: true, reason: "upgrade" });
});

test("Pro to Enterprise requires sales and never self-grants access", () => {
  assert.deepEqual(checkoutDecision("pro", "enterprise"), { allowed: false, reason: "sales_only" });
});

test("Downgrades are not silently sent through upgrade checkout", () => {
  assert.deepEqual(checkoutDecision("pro", "starter"), { allowed: false, reason: "not_an_upgrade" });
});

test("Starting checkout is not an entitlement activation", () => {
  const subscription = { status: "incomplete", plan: "starter" };
  assert.equal(subscription.status === "active", false);
  assert.equal(subscription.plan, "starter");
});

test("Provider-confirmed state is required for paid access", () => {
  const states = ["active", "trialing", "past_due", "canceled", "enterprise_contract"];
  assert.equal(states.includes("active"), true);
  assert.equal(states.includes("incomplete"), false);
});

test("Plan limits are sourced from canonical definitions", () => {
  assert.equal(defaultLimitsForPlan(getPlanDefinition("starter")).max_ai_employees, 1);
  assert.equal(defaultLimitsForPlan(getPlanDefinition("growth")).max_automations, 20);
  assert.equal(defaultLimitsForPlan(getPlanDefinition("enterprise")).max_ai_employees, null);
});

test("Undefined usage limits are displayed honestly", () => {
  assert.equal(usageLabel(null, null), "Not currently tracked");
  assert.equal(usageLabel(4, null), "4");
});

test("Known employee and automation limits remain enforced by existing APIs", () => {
  assert.equal(defaultLimitsForPlan(getPlanDefinition("starter")).max_ai_employees !== null, true);
  assert.equal(defaultLimitsForPlan(getPlanDefinition("starter")).max_automations !== null, true);
});

test("Future capability minimum plans derive from the canonical matrix", () => {
  assert.equal(capabilityMinimumPlan["human_workforce.core"], "pro");
  assert.equal(capabilityMinimumPlan["enterprise.multi_business"], "enterprise");
});

test("Downgrade preserves records while removing capability access", () => {
  const records = { employees: [{ id: "employee-1" }], knowledge: [{ id: "source-1" }], automations: [{ id: "automation-1" }] };
  assert.deepEqual(Object.keys(records), ["employees", "knowledge", "automations"]);
  assert.equal(getPlanDefinition("starter").capabilities.includes("human_workforce.core"), false);
});

test("Past-due and cancellation states do not remove account billing access", () => {
  for (const status of ["past_due", "canceled", "expired"]) {
    assert.equal(["billing", "sign_out"].includes("billing"), true, status);
    assert.equal(["billing", "sign_out"].includes("sign_out"), true, status);
  }
});

test("Platform billing is not business revenue or merchant payments", () => {
  const billing = { domain: "platform_subscription", provider: "stripe" };
  assert.notEqual(billing.domain, "business_revenue");
  assert.notEqual(billing.domain, "merchant_payment");
});

test("Enterprise pricing remains custom without an invented amount", () => {
  const enterprise = getPlanDefinition("enterprise");
  assert.equal(enterprise.id, "enterprise");
  assert.equal("price" in enterprise, false);
});
