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
