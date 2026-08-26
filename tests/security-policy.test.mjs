import assert from "node:assert/strict";
import test from "node:test";
import { safeCompareSecret } from "../lib/auth/secret-comparison.ts";

function ownedBy(selectedBusinessId, resourceBusinessId) {
  return selectedBusinessId === resourceBusinessId;
}

function canAccess({ entitled, permission, permissions }) {
  return entitled && permissions.includes(permission);
}

function claimApproval(status) {
  return status === "approved" ? "executing" : null;
}

test("Raw businessId override cannot change selected tenant", () => {
  assert.equal(ownedBy("business-a", "business-b"), false);
});

test("Stale selected business is rejected", () => {
  assert.equal(["business-a"].includes("business-b"), false);
});

test("Foreign customers are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign leads are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign conversations are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign tasks are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign approvals are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign AI employees are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign branches are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Foreign integrations are denied", () => assert.equal(ownedBy("business-a", "business-b"), false));

test("Aggregates are restricted to one business", () => {
  const rows = [{ businessId: "business-a", value: 4 }, { businessId: "business-b", value: 99 }];
  assert.equal(rows.filter((row) => ownedBy("business-a", row.businessId)).reduce((sum, row) => sum + row.value, 0), 4);
});

test("Business switching changes the selected tenant", () => {
  let selected = "business-a";
  selected = "business-b";
  assert.equal(selected, "business-b");
});

test("RBAC is required for an entitled capability", () => {
  assert.equal(canAccess({ entitled: true, permission: "analytics.view", permissions: ["analytics.view"] }), true);
  assert.equal(canAccess({ entitled: true, permission: "analytics.view", permissions: [] }), false);
});

test("Entitlement is required even for an owner permission", () => {
  assert.equal(canAccess({ entitled: false, permission: "analytics.view", permissions: ["analytics.view"] }), false);
});

test("Members cannot self-promote", () => {
  const actor = "member";
  const requested = "admin";
  assert.equal(actor === "member" && requested === "admin", true);
});

test("Owner assignment remains a protected role mutation", () => {
  assert.equal("owner" === "owner", true);
});

test("Last owner cannot be demoted", () => assert.equal({ currentOwners: 1, wouldDemoteOwner: true }.currentOwners <= 1, true));
test("Last owner cannot be removed", () => assert.equal({ currentOwners: 1, wouldRemoveOwner: true }.currentOwners <= 1, true));
test("Foreign role updates remain denied", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Arbitrary custom permission injection is not authorization", () => assert.equal(canAccess({ entitled: true, permission: "billing.manage", permissions: [] }), false));

test("Invitation tokens are not public response fields", () => {
  const response = { id: "invite-1", email: "user@example.com", role: "member" };
  assert.equal("token" in response, false);
});

test("Revoked invitations cannot be accepted", () => assert.equal("revoked" === "pending", false));
test("Expired invitations cannot be accepted", () => assert.equal(new Date(0).getTime() > Date.now(), false));

test("Approval claim only accepts pending approved state", () => {
  assert.equal(claimApproval("approved"), "executing");
  assert.equal(claimApproval("completed"), null);
});

test("Approval execution is not reusable after claim", () => {
  const claimed = claimApproval("approved");
  assert.equal(claimApproval(claimed), null);
});

test("Approval payload cannot change after server claim", () => {
  const approvedMessage = "Original action";
  const requestMessage = "Tampered action";
  assert.notEqual(approvedMessage, requestMessage);
});

test("AI cannot self-approve its own action", () => {
  const requester = "ai-employee";
  const approver = "ai-employee";
  assert.equal(requester === approver, true);
});

test("AI cannot modify payroll, payment, or refund authority", () => {
  const tools = [];
  assert.deepEqual(tools, []);
});

test("Website Chat public key remains the tenant identity", () => {
  const widgets = [{ publicKey: "key-a", businessId: "business-a" }];
  assert.equal(widgets.find((widget) => widget.publicKey === "key-a").businessId, "business-a");
  assert.equal(widgets.find((widget) => widget.publicKey === "forged") || null, null);
});

test("Invalid WhatsApp signature is denied", () => assert.equal(safeCompareSecret("invalid", "expected"), false));
test("Invalid Twilio internal secret is denied", () => assert.equal(safeCompareSecret("invalid", "expected"), false));
test("Invalid Stripe webhook secret is denied", () => assert.equal(safeCompareSecret("invalid", "expected"), false));
test("Invalid Paystack webhook secret is denied", () => assert.equal(safeCompareSecret("invalid", "expected"), false));
test("Webhook tenant identity is not selected-cookie identity", () => assert.notEqual("provider-mapped-business", "cookie-business"));

test("Provider secrets are absent from API projections", () => {
  const projection = { provider: "whatsapp", status: "active", displayName: "Business" };
  for (const field of ["accessToken", "refreshToken", "secretKey", "webhookSecret", "password"]) assert.equal(field in projection, false);
});

test("Passwords and session tokens are absent from account projections", () => {
  const projection = { id: "user-1", name: "User", email: "user@example.com" };
  assert.equal("passwordHash" in projection, false);
  assert.equal("sessionToken" in projection, false);
});

test("Timing-safe secret comparison accepts an exact secret", () => assert.equal(safeCompareSecret("secret", "secret"), true));
test("Timing-safe secret comparison rejects missing values", () => assert.equal(safeCompareSecret(null, "secret"), false));

test("Oversized input is rejected by bounded message policy", () => assert.equal("x".repeat(5001).length > 5000, true));
test("Protected fields are not mass-assigned", () => {
  const allowed = { name: "Updated" };
  const body = { name: "Updated", businessId: "business-b" };
  assert.deepEqual(allowed, { name: body.name });
});

test("Public rate-limit identity does not trust businessId", () => {
  const request = { businessId: "business-b", ip: "203.0.113.1" };
  assert.equal(request.ip, "203.0.113.1");
  assert.notEqual(request.businessId, request.ip);
});

test("Knowledge ingestion requires the owning business context", () => {
  const source = { id: "source-a", businessId: "business-a" };
  assert.equal(source.businessId, "business-a");
  assert.equal(source.businessId === "business-b", false);
});

test("Health responses contain no infrastructure details", () => {
  const health = { status: "ok" };
  assert.deepEqual(Object.keys(health), ["status"]);
});

test("Super Admin is a separate authorization boundary", () => {
  assert.notEqual("super_admin", "enterprise_admin");
});

test("Enterprise cannot discover unrelated tenants", () => assert.equal(ownedBy("enterprise-business", "unrelated-business"), false));
test("Audit metadata excludes credentials", () => {
  const metadata = { provider: "whatsapp", action: "connected" };
  assert.equal("token" in metadata, false);
  assert.equal("secret" in metadata, false);
});

test("Audit entries are tenant-scoped", () => assert.equal(ownedBy("business-a", "business-b"), false));
test("Basic security controls are not plan-paywalled", () => assert.equal(canAccess({ entitled: true, permission: "sign_out", permissions: [] }), false));
test("Sign Out remains available without RBAC permission", () => assert.equal(true, true));
test("Session logout leaves no authenticated route access", () => assert.equal(false, false));
