import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planDefinitions, planOrder } from "../lib/billing/plan-definitions.ts";

const expectedPlans = ["starter", "growth", "pro", "enterprise"];

test("canonical pricing plans use the four-tier order", () => {
  assert.deepEqual(planOrder, expectedPlans);
  assert.deepEqual(planDefinitions.map((plan) => plan.id), expectedPlans);
});

test("pricing plan definitions contain no unknown plans", () => {
  assert.equal(planDefinitions.every((plan) => expectedPlans.includes(plan.id)), true);
});

test("canonical capabilities are monotonic across plan tiers", () => {
  for (let index = 1; index < planDefinitions.length; index += 1) {
    const previous = new Set(planDefinitions[index - 1].capabilities);
    assert.equal([...previous].every((capability) => planDefinitions[index].capabilities.includes(capability)), true);
  }
});

// Pricing copy ($XX placeholders, tier taglines, CTAs) was factored out of
// app/pricing/page.tsx into lib/billing/pricing-presentation.ts so the
// public pricing page and the onboarding plan-selection step can share one
// canonical copy source instead of duplicating it (see that file's header
// comment). These tests read both files and check the combined source, so
// they track that intent rather than assuming everything lives inline in
// the page component.
async function pricingSources() {
  const [page, presentation] = await Promise.all([
    readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/billing/pricing-presentation.ts", import.meta.url), "utf8"),
  ]);
  return `${page}\n${presentation}`;
}

test("public pricing shows real approved working prices and the Enterprise contact CTA", async () => {
  const source = await pricingSources();
  assert.match(source, /GHS 699/);
  assert.match(source, /GHS 1,999/);
  assert.match(source, /GHS 4,999/);
  assert.match(source, /Custom/);
  assert.match(source, /Contact Sales/);
  assert.match(source, /Coming Soon/);
});

test("public pricing page is metadata-addressable", async () => {
  const source = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
  assert.match(source, /SuperKuba Pricing \| Starter, Growth, Pro & Enterprise/);
  assert.match(source, /export default function PricingPage/);
});

test("progressive cards use customer-friendly tier-specific presentation", async () => {
  const [source, presentation] = await Promise.all([
    readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/billing/pricing-presentation.ts", import.meta.url), "utf8"),
  ]);
  const combined = `${source}\n${presentation}`;
  assert.match(combined, /Your first AI employee/);
  assert.match(combined, /Your AI customer and sales team/);
  assert.match(combined, /Your complete AI workforce/);
  assert.match(combined, /Your AI operating infrastructure/);
  assert.match(source, /Everything in \{planDefinitions\.find/);
  assert.match(combined, /AI-assisted Appointments & Tickets/);
  assert.doesNotMatch(combined, /Global currency|Business Profile|Business Brain.*tier/);
});

test("requested operations and AI-assist placements follow canonical tiers", () => {
  const growth = new Set(planDefinitions.find((plan) => plan.id === "growth")?.capabilities);
  const pro = new Set(planDefinitions.find((plan) => plan.id === "pro")?.capabilities);
  const enterprise = new Set(planDefinitions.find((plan) => plan.id === "enterprise")?.capabilities);
  assert.equal(growth.has("customer_ops.appointments"), true);
  assert.equal(growth.has("customer_ops.tickets"), true);
  assert.equal(growth.has("customer_ops.ai_assist"), false);
  assert.equal(pro.has("customer_ops.ai_assist"), true);
  assert.equal(enterprise.has("enterprise.multi_business"), true);
});

test("pricing amounts are the approved real working prices, not placeholders", async () => {
  const source = await readFile(new URL("../lib/billing/pricing-presentation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\$XX/);
  assert.match(source, /price: "GHS 699"/);
  assert.match(source, /price: "GHS 1,999"/);
  assert.match(source, /price: "GHS 4,999"/);
  assert.match(source, /price: "Custom"/);
});
