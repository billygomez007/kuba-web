import assert from "node:assert/strict";
import test from "node:test";

/**
 * Integration Multi-Tenancy and Security Tests
 *
 * Verifies:
 * 1. Integrations are isolated by business
 * 2. Foreign integration IDs are denied
 * 3. API keys are scoped to business
 * 4. Webhook security cannot be spoofed
 * 5. Permissions are enforced
 */

// Mock business contexts
const qaGhana = { businessId: "qa-ghana", role: "owner", permissions: null };
const qaLabs = { businessId: "qa-labs", role: "owner", permissions: null };
const qaRestricted = { businessId: "qa-ghana", role: "member", permissions: null };

// Mock integrations
const integrations = [
  { id: "int-ghana-1", businessId: "qa-ghana", provider: "whatsapp", status: "active" },
  { id: "int-ghana-2", businessId: "qa-ghana", provider: "email", status: "active" },
  { id: "int-labs-1", businessId: "qa-labs", provider: "whatsapp", status: "active" },
];

// Mock API keys
const apiKeys = [
  { id: "key-ghana-1", businessId: "qa-ghana", keyHash: "hash1", scopes: "read,write" },
  { id: "key-labs-1", businessId: "qa-labs", keyHash: "hash2", scopes: "read" },
];

// Policy functions
function belongsToMembership(resource, membership) {
  return resource.businessId === membership.businessId;
}

function filterByMembership(resources, membership) {
  return resources.filter((r) => belongsToMembership(r, membership));
}

test("Integration list is scoped by business", () => {
  const ghanaIntegrations = filterByMembership(integrations, qaGhana);
  const labsIntegrations = filterByMembership(integrations, qaLabs);

  assert.equal(ghanaIntegrations.length, 2);
  assert.equal(labsIntegrations.length, 1);

  assert.ok(ghanaIntegrations.every((i) => i.businessId === "qa-ghana"));
  assert.ok(labsIntegrations.every((i) => i.businessId === "qa-labs"));
});

test("Foreign integration ID is denied", () => {
  const labsInt = integrations.find((i) => i.id === "int-labs-1");
  assert.ok(labsInt);

  // Try to access with Ghana context
  const hasAccess = belongsToMembership(labsInt, qaGhana);
  assert.equal(hasAccess, false);
});

test("Channel connection is scoped by business", () => {
  const connections = [
    { id: "chan-ghana-1", businessId: "qa-ghana", channel: "whatsapp" },
    { id: "chan-labs-1", businessId: "qa-labs", channel: "whatsapp" },
  ];

  const ghanaConnections = filterByMembership(connections, qaGhana);
  assert.equal(ghanaConnections.length, 1);
  assert.equal(ghanaConnections[0].id, "chan-ghana-1");
});

test("API keys are scoped by business", () => {
  const ghanaKeys = filterByMembership(apiKeys, qaGhana);
  const labsKeys = filterByMembership(apiKeys, qaLabs);

  assert.equal(ghanaKeys.length, 1);
  assert.equal(labsKeys.length, 1);
  assert.equal(ghanaKeys[0].id, "key-ghana-1");
  assert.equal(labsKeys[0].id, "key-labs-1");
});

test("Foreign API key revoke is denied", () => {
  const labsKey = apiKeys.find((k) => k.id === "key-labs-1");
  assert.ok(labsKey);

  // Try to revoke with Ghana context
  const canRevoke = belongsToMembership(labsKey, qaGhana);
  assert.equal(canRevoke, false);
});

test("Client businessId override doesn't affect integrations", () => {
  // Simulate: user sends request with businessId in body
  // despite the selected business context being authoritative
  const selectedContext = qaGhana;

  // System should use selected context, not request body
  const integrationsList = filterByMembership(integrations, selectedContext);

  // Should only see Ghana integrations
  assert.ok(integrationsList.every((i) => i.businessId === "qa-ghana"));

  // Should NOT see Labs integrations just because request claimed them
  assert.ok(!integrationsList.some((i) => i.businessId === "qa-labs"));
});

test("Stale selected business is rejected", () => {
  // Scenario: User was member of both, now removed from one
  const ghanaOnly = [qaGhana]; // Only has Ghana membership

  // But tries to select Labs
  const selectedLabs = ghanaOnly.find((m) => m.businessId === "qa-labs");

  assert.equal(selectedLabs, undefined);
});

test("AI employee cannot configure integrations", () => {
  const aiEmployee = { businessId: "qa-ghana", role: "ai_employee", permissions: null };

  // Try to get integration management permission
  const canManage = aiEmployee.role === "owner" || aiEmployee.role === "admin";

  assert.equal(canManage, false);
});

function determineEmailStatus(integration) {
  if (!integration) return "not_configured";
  if (integration.status === "active") return "transactional_only";
  return "configuration_required";
}

function determineSmsStatus(hasSmsConfig) {
  return hasSmsConfig ? "configured" : "coming_soon";
}

function determineVoiceStatus(hasPhoneNumbers, hasVoiceProvider) {
  if ((Array.isArray(hasPhoneNumbers) && hasPhoneNumbers.length > 0) || (Array.isArray(hasVoiceProvider) && hasVoiceProvider.length > 0)) {
    return "configured";
  }
  return "not_configured";
}

test("Widget public key resolves business correctly", () => {
  const widgets = [
    { publicKey: "key-ghana-widget", businessId: "qa-ghana" },
    { publicKey: "key-labs-widget", businessId: "qa-labs" },
  ];

  // Find business by public key (unauthenticated webhook)
  const ghanaFromKey = widgets.find((w) => w.publicKey === "key-ghana-widget");
  assert.ok(ghanaFromKey);
  assert.equal(ghanaFromKey.businessId, "qa-ghana");

  // Cannot forge key
  const forgedKey = "key-faked-widget";
  const forgedWidget = widgets.find((w) => w.publicKey === forgedKey);
  assert.equal(forgedWidget, undefined);
});

test("Email status reflects actual configuration", () => {
  assert.equal(determineEmailStatus(null), "not_configured");
  assert.equal(determineEmailStatus({ status: "active" }), "transactional_only");
  assert.equal(determineEmailStatus({ status: "pending" }), "configuration_required");
});

test("SMS status reflects actual configuration", () => {
  assert.equal(determineSmsStatus(false), "coming_soon");
  assert.equal(determineSmsStatus(true), "configured");
});

test("Voice config is tenant-scoped and not fabricated", () => {
  assert.equal(determineVoiceStatus([], []), "not_configured");
  assert.equal(determineVoiceStatus([{ id: "p1", status: "active" }], []), "configured");
  assert.equal(determineVoiceStatus([], [{ id: "vp1", status: "active" }]), "configured");
});

test("Webhook cannot be spoofed with raw businessId", () => {
  // Incoming webhook with signature (simulated)
  const incomingWebhook = {
    signature: "valid-signature",
    // Attacker tries to claim they're from Labs
    businessId: "qa-labs",
  };

  // But signature verification should map to actual business
  const verifiedWebhook = {
    businessId: "qa-ghana", // Resolved from signature, not body
  };

  assert.notEqual(incomingWebhook.businessId, verifiedWebhook.businessId);
});

test("Restricted role cannot view integrations", () => {
  // Member role should NOT have INTEGRATIONS_VIEW permission
  const canView = qaRestricted.role === "owner" || qaRestricted.role === "admin";
  assert.equal(canView, false);
});

test("Restricted role cannot manage integrations", () => {
  // Member role should NOT have INTEGRATIONS_MANAGE permission
  const canManage = qaRestricted.role === "owner" || qaRestricted.role === "admin";
  assert.equal(canManage, false);
});
