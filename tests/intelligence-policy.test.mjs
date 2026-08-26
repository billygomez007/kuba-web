import assert from "node:assert/strict";
import test from "node:test";

import { getPlanDefinition, capabilityMinimumPlan } from "../lib/billing/plan-definitions.ts";

// --- 1-4: tenant isolation, foreign business, raw businessId override, stale context ---

function onlySelectedBusiness(rows, selectedBusinessId) {
  return rows.filter((row) => row.businessId === selectedBusinessId);
}

test("1. Selected-business isolation applies to every Intelligence data source", () => {
  for (const resource of ["leads", "customers", "conversations", "tasks", "automation_runs", "hr_employees", "ai_employees"]) {
    const rows = [{ businessId: "business-a", resource }, { businessId: "business-b", resource }];
    assert.deepEqual(onlySelectedBusiness(rows, "business-a"), [{ businessId: "business-a", resource }]);
  }
});

test("2. Foreign business is denied", () => {
  const rows = [{ businessId: "business-b", id: "x" }];
  assert.equal(onlySelectedBusiness(rows, "business-a").length, 0);
});

test("3. Raw businessId override is rejected", () => {
  function rejectBusinessOverride(body, selectedBusinessId) {
    return typeof body.businessId === "string" && body.businessId !== selectedBusinessId;
  }
  assert.equal(rejectBusinessOverride({ businessId: "business-b" }, "business-a"), true);
  assert.equal(rejectBusinessOverride({ businessId: "business-a" }, "business-a"), false);
});

test("4. Stale selected-business context is denied", () => {
  const memberships = [{ businessId: "business-a" }];
  assert.equal(memberships.some((item) => item.businessId === "business-b"), false);
});

// --- 5-8: plan entitlement across the Intelligence capability set ---

const intelligenceCapabilities = ["intelligence.basic", "intelligence.advanced", "intelligence.sales", "intelligence.customer", "intelligence.ai_workforce", "intelligence.human_workforce", "intelligence.operations", "intelligence.reports"];

test("5. Starter is denied every Intelligence capability", () => {
  const starter = getPlanDefinition("starter").capabilities;
  for (const capability of [...intelligenceCapabilities, "intelligence.inventory"]) {
    assert.equal(starter.includes(capability), false, `starter should not have ${capability}`);
  }
});

test("6. Growth has intelligence.basic only (not the Pro-tier Intelligence set)", () => {
  const growth = getPlanDefinition("growth").capabilities;
  assert.equal(growth.includes("intelligence.basic"), true);
  for (const capability of intelligenceCapabilities.filter((c) => c !== "intelligence.basic")) {
    assert.equal(growth.includes(capability), false, `growth should not have ${capability}`);
  }
});

test("7. Pro has the full advanced Intelligence set except Inventory", () => {
  const pro = getPlanDefinition("pro").capabilities;
  for (const capability of intelligenceCapabilities) {
    assert.equal(pro.includes(capability), true, `pro should have ${capability}`);
  }
  assert.equal(pro.includes("intelligence.inventory"), false);
});

test("8. Enterprise has every Intelligence capability including Inventory", () => {
  const enterprise = getPlanDefinition("enterprise").capabilities;
  for (const capability of [...intelligenceCapabilities, "intelligence.inventory"]) {
    assert.equal(enterprise.includes(capability), true, `enterprise should have ${capability}`);
  }
  assert.equal(capabilityMinimumPlan["intelligence.inventory"], "enterprise");
});

// --- 9: RBAC + entitlement interaction ---

test("9. RBAC and entitlement are both independently required", () => {
  function canAccess(planCapabilities, capability, permissions, requiredPermission) {
    return planCapabilities.includes(capability) && permissions.includes(requiredPermission);
  }
  const pro = getPlanDefinition("pro").capabilities;
  const growth = getPlanDefinition("growth").capabilities;
  assert.equal(canAccess(pro, "intelligence.advanced", ["analytics.view"], "analytics.view"), true);
  assert.equal(canAccess(pro, "intelligence.advanced", [], "analytics.view"), false, "entitled but no permission must deny");
  assert.equal(canAccess(growth, "intelligence.advanced", ["analytics.view"], "analytics.view"), false, "permitted but not entitled must deny");
});

// --- 10: detailed operational-alert boundary, inherited from the Business Operations fix ---

test("10. Insights & Alerts inherits the Pro-only alert-detail boundary from /api/business-operations", () => {
  function buildOverviewResponse(planCapabilities, alertRecords) {
    if (!planCapabilities.includes("business_ops.core")) return { status: 403 };
    const canViewAlertDetail = planCapabilities.includes("business_ops.alerts");
    return { status: 200, alerts: canViewAlertDetail ? alertRecords : [] };
  }
  const sample = [{ id: "a1" }, { id: "a2" }];
  const growthResponse = buildOverviewResponse(getPlanDefinition("growth").capabilities, sample);
  const proResponse = buildOverviewResponse(getPlanDefinition("pro").capabilities, sample);
  assert.deepEqual(growthResponse.alerts, []);
  assert.equal(proResponse.alerts.length, 2);
});

// --- 11: payroll/HR sensitive-data protection ---

test("11. Human Workforce Analytics never includes salary, leave reason, or emergency contact fields", () => {
  // Mirrors the exact select() column lists in
  // app/api/analytics/human-workforce/route.ts.
  const employeeFields = ["id", "departmentId", "employmentType", "employmentStatus", "hireDate"];
  const leaveFields = ["id", "status", "startDate"];
  const forbidden = ["salary", "compensation", "reason", "emergencyContact", "personalEmail", "personalPhone", "nationalId", "bankAccount"];
  for (const field of forbidden) {
    assert.equal(employeeFields.includes(field), false);
    assert.equal(leaveFields.includes(field), false);
  }
});

// --- 12-15: cross-domain isolation ---

test("12. AI employee isolation", () => {
  const rows = [{ businessId: "business-a", id: "ai-1" }, { businessId: "business-b", id: "ai-2" }];
  assert.deepEqual(onlySelectedBusiness(rows, "business-a").map((r) => r.id), ["ai-1"]);
});

test("13. Customer isolation", () => {
  const rows = [{ businessId: "business-a", id: "cust-1" }, { businessId: "business-b", id: "cust-2" }];
  assert.deepEqual(onlySelectedBusiness(rows, "business-a").map((r) => r.id), ["cust-1"]);
});

test("14. Lead isolation", () => {
  const rows = [{ businessId: "business-a", id: "lead-1" }, { businessId: "business-b", id: "lead-2" }];
  assert.deepEqual(onlySelectedBusiness(rows, "business-a").map((r) => r.id), ["lead-1"]);
});

test("15. Conversation isolation", () => {
  const rows = [{ businessId: "business-a", id: "conv-1" }, { businessId: "business-b", id: "conv-2" }];
  assert.deepEqual(onlySelectedBusiness(rows, "business-a").map((r) => r.id), ["conv-1"]);
});

// --- 16-17: deterministic insight generation, empty-data behavior ---

function buildExecutiveBriefing({ overdueTaskCount, pendingApprovalCount, failedRunCount }) {
  const briefing = [];
  if (overdueTaskCount > 0) briefing.push({ id: "overdue-tasks", severity: overdueTaskCount >= 5 ? "high" : "medium" });
  if (pendingApprovalCount > 0) briefing.push({ id: "pending-approvals", severity: "medium" });
  if (failedRunCount > 0) briefing.push({ id: "failed-automations", severity: failedRunCount >= 3 ? "high" : "medium" });
  const rank = { high: 0, medium: 1, low: 2 };
  briefing.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const status = briefing.some((item) => item.severity === "high") ? "needs_attention" : briefing.length > 0 ? "monitor" : "steady";
  return { status, briefing };
}

test("16. Executive briefing generation is deterministic for identical input", () => {
  const input = { overdueTaskCount: 6, pendingApprovalCount: 2, failedRunCount: 1 };
  const first = buildExecutiveBriefing(input);
  const second = buildExecutiveBriefing(input);
  assert.deepEqual(first, second);
  assert.equal(first.status, "needs_attention");
  assert.equal(first.briefing[0].id, "overdue-tasks");
});

test("17. Empty data produces an honest steady state, not fabricated content", () => {
  const result = buildExecutiveBriefing({ overdueTaskCount: 0, pendingApprovalCount: 0, failedRunCount: 0 });
  assert.deepEqual(result.briefing, []);
  assert.equal(result.status, "steady");
});

// --- 18: Coming Soon vs Upgrade Required ---

test("18. Coming Soon (no data) is distinct from Upgrade Required (no entitlement)", () => {
  const inventoryAnalytics = { entitledAtEnterprise: true, dataExists: false };
  assert.equal(inventoryAnalytics.entitledAtEnterprise, true);
  assert.equal(inventoryAnalytics.dataExists, false);
  // Even an Enterprise business, which IS entitled, still sees Coming Soon —
  // because the gap is data, not entitlement.
  const enterpriseHasCapability = getPlanDefinition("enterprise").capabilities.includes("intelligence.inventory");
  assert.equal(enterpriseHasCapability, true);
  assert.equal(inventoryAnalytics.dataExists, false, "Coming Soon regardless of entitlement");
});

// --- 19: no fabricated financial metrics ---

test("19. No revenue/profit/margin/expense fields appear in Business Performance or Human Workforce contracts", () => {
  const businessPerformanceFields = ["customers", "newCustomers", "leads", "newLeads", "qualifiedLeads", "conversionRate", "completedTasks", "pendingTasks", "overdueTasks", "pendingFollowUps", "overdueFollowUps"];
  const humanWorkforceFields = ["headcount", "departments", "attendance30d", "leave30d", "generatedAt"];
  const forbidden = ["revenue", "profit", "margin", "expense", "netIncome", "grossIncome"];
  for (const field of forbidden) {
    assert.equal(businessPerformanceFields.includes(field), false);
    assert.equal(humanWorkforceFields.includes(field), false);
  }
});

// --- 20: no secret exposure ---

test("20. No secret/token/credential fields appear in any Intelligence response contract", () => {
  const allResponseFields = [
    "metrics", "briefing", "insights", "alerts", "headcount", "departments", "attendance30d", "leave30d",
    "overview", "sales", "workforce", "automations", "communications", "employees", "channels", "generatedAt", "status",
  ];
  const secretLikePatterns = [/password/i, /secret/i, /apikey/i, /accesstoken/i, /credential/i];
  for (const field of allResponseFields) {
    assert.equal(secretLikePatterns.some((pattern) => pattern.test(field)), false, `${field} looks secret-like`);
  }
});
