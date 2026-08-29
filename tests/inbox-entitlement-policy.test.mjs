// Prior audit finding: a Starter-tier business could perform Growth-gated
// conversation management (takeover/assign/status-change/resume) because
// /api/inbox/workspace and the conversation mutation routes had no
// server-side capability check — only the dashboard nav hid the
// Growth-gated /dashboard/conversations page. Viewing the Inbox itself
// stays Starter-accessible (customer_ops.inbox is Starter-included); the
// bug was specifically the advanced conversation-management actions.
//
// Matches the static-source-inspection style of tests/ai-authority-policy.test.mjs
// and tests/whatsapp-webhook-policy.test.mjs: these routes import the full
// Better Auth/DB stack, so this suite asserts the gate exists in source
// rather than executing the route.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getPlanDefinition } from "../lib/billing/plan-definitions.ts";

const MUTATION_ROUTES = [
  "app/api/conversations/takeover/route.ts",
  "app/api/conversations/status/route.ts",
  "app/api/conversations/assign/route.ts",
  "app/api/conversations/assign-human/route.ts",
  "app/api/conversations/resume/route.ts",
];

for (const file of MUTATION_ROUTES) {
  test(`${file} enforces the customer_ops.conversations capability server-side (not just a hidden nav item)`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /hasCapability\(/);
    assert.match(source, /customer_ops\.conversations/);
    assert.match(source, /FEATURE_NOT_ENTITLED/);
  });
}

test("app/api/inbox/workspace/route.ts asserts the base customer_ops.inbox capability", async () => {
  const source = await readFile("app/api/inbox/workspace/route.ts", "utf8");
  assert.match(source, /hasCapability\(/);
  assert.match(source, /customer_ops\.inbox/);
});

test("Starter does not include customer_ops.conversations (the capability the mutation routes now require)", () => {
  const starter = getPlanDefinition("starter");
  assert.equal(starter.capabilities.includes("customer_ops.conversations"), false);
  // Starter must still be able to view its own Inbox — this bug fix must
  // not regress the Starter-included base Inbox experience.
  assert.equal(starter.capabilities.includes("customer_ops.inbox"), true);
});

test("Growth, Pro, and Enterprise all include customer_ops.conversations (the positive cases)", () => {
  for (const planId of ["growth", "pro", "enterprise"]) {
    const plan = getPlanDefinition(planId);
    assert.equal(plan.capabilities.includes("customer_ops.conversations"), true, `${planId} should include customer_ops.conversations`);
  }
});

test("no conversation mutation route trusts a client-supplied businessId — the acting business always comes from session-derived membership", async () => {
  for (const file of MUTATION_ROUTES) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /body\.businessId/);
    assert.match(source, /getBusinessMembership\(\s*session\.user\.id,/);
  }
});
