import test from "node:test";
import assert from "node:assert/strict";
import { assertCampaignTransition } from "../lib/marketing/lifecycle.ts";
import { PERMISSIONS, getRolePermissions } from "../lib/auth/permission-definitions.ts";

test("marketing campaign lifecycle rejects skipping approval", () => {
  assert.doesNotThrow(() => assertCampaignTransition("draft", "pending_approval"));
  assert.throws(() => assertCampaignTransition("draft", "active"));
  assert.doesNotThrow(() => assertCampaignTransition("approved", "scheduled"));
  assert.throws(() => assertCampaignTransition("completed", "active"));
});

test("manager receives native Marketing management while sales remains read-only", () => {
  const manager = getRolePermissions("manager");
  const sales = getRolePermissions("sales");
  assert.ok(manager.includes(PERMISSIONS.MARKETING_MANAGE));
  assert.ok(manager.includes(PERMISSIONS.MARKETING_APPROVALS_REVIEW));
  assert.ok(sales.includes(PERMISSIONS.MARKETING_VIEW));
  assert.equal(sales.includes(PERMISSIONS.MARKETING_MANAGE), false);
});
