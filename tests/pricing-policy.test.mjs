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

test("public pricing preserves placeholder prices and Enterprise contact CTA", async () => {
  const source = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
  assert.match(source, /\$XX/);
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
  const source = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Run Your Business/);
  assert.match(source, /Automate Your Business/);
  assert.match(source, /Operate With AI/);
  assert.match(source, /Complete Business Operating System/);
  assert.match(source, /Everything in \{planDefinitions\.find/);
  assert.match(source, /AI-assisted Appointments & Tickets/);
  assert.doesNotMatch(source, /Global currency|Business Profile|Business Brain.*tier/);
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

test("pricing amounts remain unchanged placeholders", async () => {
  const source = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/price: "\$XX"/g) || []).length, 3);
  assert.match(source, /price: "Custom"/);
});
