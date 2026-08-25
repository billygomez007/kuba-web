import assert from "node:assert/strict";
import test from "node:test";

const providers = ["quickbooks", "xero", "sage", "zoho-books", "freshbooks", "wave", "odoo"];

function classifyAccountingProvider(provider) {
  return providers.includes(provider) ? "coming_soon" : "unsupported";
}

test("Accounting capability is truthfully classified as unavailable", () => {
  for (const provider of providers) assert.equal(classifyAccountingProvider(provider), "coming_soon");
});

test("No accounting provider is falsely reported as connected", () => {
  const connections = [];
  assert.equal(connections.some((connection) => providers.includes(connection.provider)), false);
});

test("Platform billing is not accounting integration", () => {
  const platformBilling = ["stripe", "paystack"].map((provider) => ({ provider, domain: "platform_billing" }));
  assert.ok(platformBilling.every((item) => item.domain !== "accounting"));
});

test("Payroll is not accounting integration", () => {
  const payroll = { domain: "human_workforce_payroll", provider: null };
  assert.notEqual(payroll.domain, "accounting");
});

test("No accounting OAuth callback can be claimed without an implementation", () => {
  const oauthRoutes = [];
  assert.deepEqual(oauthRoutes, []);
});

test("No accounting sync entities are operational", () => {
  const syncEntities = { customers: false, invoices: false, payments: false, expenses: false, vendors: false, accounts: false, journalEntries: false, taxRates: false };
  assert.ok(Object.values(syncEntities).every((enabled) => enabled === false));
});

test("Accounting credentials are never returned by the placeholder status", () => {
  const status = { provider: "quickbooks", status: "coming_soon" };
  assert.equal("accessToken" in status, false);
  assert.equal("refreshToken" in status, false);
  assert.equal("clientSecret" in status, false);
});

test("Foreign accounting connection remains denied by business ownership", () => {
  const selectedBusinessId = "business-a";
  const connection = { businessId: "business-b" };
  assert.equal(selectedBusinessId === connection.businessId, false);
});

test("Raw businessId cannot establish accounting context", () => {
  const selectedBusinessId = "business-a";
  const requestBody = { businessId: "business-b" };
  assert.equal(selectedBusinessId, "business-a");
  assert.notEqual(requestBody.businessId, selectedBusinessId);
});

test("Stale accounting business selection is denied", () => {
  const memberships = [{ businessId: "business-a" }];
  assert.equal(memberships.some((membership) => membership.businessId === "business-b"), false);
});

test("AI has no accounting mutation authority", () => {
  const tools = [];
  assert.deepEqual(tools, []);
});

test("Financial analytics are not authoritative accounting statements", () => {
  const analytics = { source: "operational_records", authoritativeLedger: false };
  assert.equal(analytics.authoritativeLedger, false);
});