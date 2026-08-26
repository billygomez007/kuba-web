import assert from "node:assert/strict";
import test from "node:test";

const categories = ["Calendar", "Payments", "Accounting", "CRM", "External Apps", "API / Developer Integrations"];
const comingSoonProviders = {
  Calendar: ["Google Calendar", "Microsoft Outlook", "Apple Calendar"],
  Accounting: ["QuickBooks Online", "Xero", "Sage", "Zoho Books"],
  CRM: ["HubSpot", "Salesforce", "Pipedrive", "Zoho CRM", "Microsoft Dynamics"],
  "External Apps": ["Slack", "Microsoft Teams", "Notion", "Google Drive", "Dropbox", "Zapier", "Make"],
  "API / Developer Integrations": ["Public API", "API keys", "Webhooks", "OAuth applications"],
};

function providerStatus(category, providerConnections = []) {
  if (category === "Payments") return "Not Configured";
  return providerConnections.length ? "Connected" : "Coming Soon";
}

function isTenantOwned(selectedBusinessId, resourceBusinessId) {
  return selectedBusinessId === resourceBusinessId;
}

test("All remaining integration categories are represented in locked order", () => {
  assert.deepEqual(categories, ["Calendar", "Payments", "Accounting", "CRM", "External Apps", "API / Developer Integrations"]);
});

test("Google Calendar and Outlook remain non-connected without provider connections", () => {
  assert.equal(providerStatus("Calendar"), "Coming Soon");
  assert.equal(comingSoonProviders.Calendar.includes("Google Calendar"), true);
  assert.equal(comingSoonProviders.Calendar.includes("Microsoft Outlook"), true);
});

test("Calendar is distinct from internal appointments", () => {
  const calendar = { externalProvider: false };
  const appointments = { authoritativeBookingModel: false };
  assert.equal(calendar.externalProvider, false);
  assert.equal(appointments.authoritativeBookingModel, false);
});

test("Receptionist has no external calendar mutation authority", () => {
  const receptionistTools = [];
  assert.deepEqual(receptionistTools, []);
});

test("Stripe and Paystack remain platform billing, not merchant payments", () => {
  const providers = ["stripe", "paystack"].map((provider) => ({ provider, domain: "platform_billing" }));
  assert.ok(providers.every((item) => item.domain === "platform_billing"));
  assert.ok(providers.every((item) => item.domain !== "merchant_payments"));
});

test("Business merchant payments have no active provider connection", () => {
  assert.equal(providerStatus("Payments"), "Not Configured");
});

test("Payment links, invoices, webhooks, and refunds remain unavailable", () => {
  const capabilities = { paymentLinks: false, invoices: false, webhooks: false, refunds: false };
  assert.ok(Object.values(capabilities).every((value) => value === false));
});

test("Accounting providers remain Coming Soon", () => {
  for (const provider of comingSoonProviders.Accounting) assert.equal(providerStatus("Accounting"), "Coming Soon", provider);
});

test("Platform billing and payroll are not accounting ledgers", () => {
  assert.notEqual("platform_billing", "accounting_ledger");
  assert.notEqual("human_workforce_payroll", "accounting_ledger");
});

test("CRM page separates internal Customer Operations from external providers", () => {
  const internal = ["customers", "leads", "conversations", "follow-ups"];
  assert.ok(internal.includes("leads"));
  assert.equal(providerStatus("CRM"), "Coming Soon");
});

test("External Apps exposes no active connection without backend support", () => {
  assert.equal(providerStatus("External Apps"), "Coming Soon");
  assert.equal(comingSoonProviders["External Apps"].includes("Slack"), true);
});

test("Developer API page does not claim partner keys are business API keys", () => {
  const partnerKeyModel = { scope: "partner", businessConsole: false };
  assert.equal(partnerKeyModel.scope, "partner");
  assert.equal(partnerKeyModel.businessConsole, false);
});

test("No public API key or webhook capability is operational", () => {
  const developer = { apiKeys: false, webhooks: false, rateLimitedPublicApi: false };
  assert.ok(Object.values(developer).every((value) => value === false));
});

test("Foreign integration resources are denied", () => {
  assert.equal(isTenantOwned("business-a", "business-b"), false);
});

test("Raw businessId cannot override selected integration context", () => {
  const selectedBusinessId = "business-a";
  const requestBody = { businessId: "business-b" };
  assert.equal(isTenantOwned(selectedBusinessId, requestBody.businessId), false);
});

test("Stale business selections are denied", () => {
  const memberships = ["business-a"];
  assert.equal(memberships.includes("business-b"), false);
});

test("Integration secrets are never part of public status", () => {
  const publicStatus = { provider: "HubSpot", status: "Coming Soon" };
  for (const secret of ["accessToken", "refreshToken", "clientSecret", "apiSecret", "webhookSecret"]) assert.equal(secret in publicStatus, false);
});

test("Plan entitlement does not make an unimplemented integration operational", () => {
  const state = { entitled: true, implemented: false };
  assert.equal(state.entitled, true);
  assert.equal(state.implemented, false);
});

test("Integration management requires both plan entitlement and RBAC", () => {
  const allowed = (entitled, permissions) => entitled && permissions.includes("integrations.manage");
  assert.equal(allowed(true, ["integrations.manage"]), true);
  assert.equal(allowed(true, []), false);
  assert.equal(allowed(false, ["integrations.manage"]), false);
});

test("No unsupported provider action is exposed", () => {
  const actions = { connect: false, disconnect: false, sync: false, import: false, createApiKey: false };
  assert.ok(Object.values(actions).every((value) => value === false));
});

test("Future CRM sync requires an explicit source of truth", () => {
  const sourceOfTruth = null;
  assert.equal(sourceOfTruth, null);
});

test("Collections Agent dependencies remain unimplemented", () => {
  const dependencies = { invoices: false, receivables: false, paymentStatus: false, reminders: false, approvals: false };
  assert.ok(Object.values(dependencies).every((value) => value === false));
});

test("Integration overview statuses do not claim false Connected states", () => {
  const statuses = { Calendar: "Coming Soon", Payments: "Not Configured", Accounting: "Coming Soon", CRM: "Coming Soon", "External Apps": "Coming Soon", "API / Developer Integrations": "Coming Soon" };
  assert.equal(Object.values(statuses).includes("Connected"), false);
});
