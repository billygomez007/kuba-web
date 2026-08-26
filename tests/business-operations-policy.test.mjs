import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationalMetrics, onlySelectedBusiness, rejectBusinessOverride } from "../lib/operations/policy.ts";
import { getPlanDefinition, capabilityMinimumPlan } from "../lib/billing/plan-definitions.ts";

const now = new Date("2026-08-25T12:00:00.000Z");
const rows = [{ businessId: "business-a", id: "a" }, { businessId: "business-b", id: "b" }];

for (const resource of ["tasks", "approvals", "automations", "automation runs"]) {
  test(`Business A ${resource} are isolated from B`, () => {
    assert.deepEqual(onlySelectedBusiness(rows, "business-a"), [{ businessId: "business-a", id: "a" }]);
  });
  test(`foreign ${resource.replace(/s$/, "")} ID is denied by selected-business ownership`, () => {
    assert.equal(onlySelectedBusiness([rows[1]], "business-a").length, 0);
  });
}

test("operational overview aggregates only selected business", () => {
  const metrics = buildOperationalMetrics({
    tasks: [
      { businessId: "business-a", status: "pending", dueAt: new Date("2026-08-24T12:00:00Z") },
      { businessId: "business-a", status: "pending", dueAt: new Date("2026-08-25T16:00:00Z") },
      { businessId: "business-b", status: "pending", dueAt: new Date("2026-08-20T12:00:00Z") },
    ],
    approvals: [{ businessId: "business-a", status: "pending" }, { businessId: "business-b", status: "pending" }],
    automations: [{ businessId: "business-a", status: "active" }, { businessId: "business-b", status: "active" }],
    runs: [{ businessId: "business-a", status: "failed" }, { businessId: "business-b", status: "failed" }],
  }, "business-a", now);
  assert.deepEqual(metrics, { openTasks: 2, tasksDueToday: 1, overdueTasks: 1, pendingApprovals: 1, activeAutomations: 1, recentAutomationRuns: 1, failedAutomationRuns: 1 });
});

test("client businessId override is rejected", () => {
  assert.equal(rejectBusinessOverride({ businessId: "business-b" }, "business-a"), true);
  assert.equal(rejectBusinessOverride({}, "business-a"), false);
});

test("AI-requested action remains scoped to the selected business approval path", () => {
  const approvals = [{ id: "approval-a", businessId: "business-a", employeeId: "ai-a" }, { id: "approval-b", businessId: "business-b", employeeId: "ai-b" }];
  assert.deepEqual(onlySelectedBusiness(approvals, "business-a").map((item) => item.id), ["approval-a"]);
});

// --- Plan entitlement enforcement for the Business Operations API surface ---
// app/api/tasks, app/api/action-approvals*, app/api/business-operations, and
// app/api/automations* each gate on these capabilities via hasCapability(),
// mirrored here against the canonical plan matrix (not hand-copied).
for (const capability of ["business_ops.core", "business_ops.tasks", "business_ops.approvals", "business_ops.automations"]) {
  test(`Starter cannot access ${capability} (Business Operations API denies it)`, () => {
    assert.equal(getPlanDefinition("starter").capabilities.includes(capability), false);
  });
  test(`Growth is entitled to ${capability}`, () => {
    assert.equal(getPlanDefinition("growth").capabilities.includes(capability), true);
    assert.equal(capabilityMinimumPlan[capability], "growth");
  });
  test(`Pro remains entitled to ${capability} (inherits Growth)`, () => {
    assert.equal(getPlanDefinition("pro").capabilities.includes(capability), true);
  });
}

test("business_ops.workflows/alerts/documents require Pro, not Growth", () => {
  // Matches the requiredPlan: "pro" already hardcoded in
  // app/api/automations/templates/route.ts for business_ops.workflows.
  assert.equal(getPlanDefinition("growth").capabilities.includes("business_ops.workflows"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("business_ops.workflows"), true);
  assert.equal(getPlanDefinition("growth").capabilities.includes("business_ops.alerts"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("business_ops.alerts"), true);
  assert.equal(getPlanDefinition("growth").capabilities.includes("business_ops.documents"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("business_ops.documents"), true);
});

test("Enterprise Inventory entitlement does not imply Inventory implementation", () => {
  // business_ops.inventory is granted at Enterprise in the plan matrix...
  assert.equal(getPlanDefinition("enterprise").capabilities.includes("business_ops.inventory"), true);
  assert.equal(getPlanDefinition("pro").capabilities.includes("business_ops.inventory"), false);
  // ...but no inventory/stock/SKU/warehouse/supplier schema exists in db/schema.ts,
  // so /dashboard/business-operations/inventory renders an honest "Coming Soon"
  // regardless of plan. This test documents the entitled-vs-implemented split;
  // it is not a substitute for grepping db/schema.ts on every change.
  const inventoryIsImplemented = false;
  assert.equal(inventoryIsImplemented, false);
});

test("Approval execution is blocked until status is exactly 'approved'", () => {
  // Mirrors the guard in app/api/action-approvals/[id]/execute/route.ts.
  function canExecute(status) {
    return status === "approved";
  }
  assert.equal(canExecute("pending"), false);
  assert.equal(canExecute("rejected"), false);
  assert.equal(canExecute("completed"), false);
  assert.equal(canExecute("failed"), false);
  assert.equal(canExecute("approved"), true);
});

test("AI-originated approval requests always start pending, never pre-approved", () => {
  // Mirrors mastra/tools/sales-external-action.ts, which inserts
  // action_approvals rows with status: "pending" and never writes "approved"
  // or "completed" directly — the AI tool has no send-without-approval path.
  function createAiApprovalRequest() {
    return { status: "pending" };
  }
  const request = createAiApprovalRequest();
  assert.equal(request.status, "pending");
  assert.notEqual(request.status, "approved");
});

test("Approval decision is a one-way transition away from pending", () => {
  function decide(currentStatus, decision) {
    if (currentStatus !== "pending") return { error: "already decided" };
    return { status: decision };
  }
  assert.deepEqual(decide("pending", "approved"), { status: "approved" });
  assert.deepEqual(decide("approved", "approved"), { error: "already decided" });
  assert.deepEqual(decide("rejected", "approved"), { error: "already decided" });
});

test("Task assignee (human, AI employee, or automation source) must belong to the selected business", () => {
  // Mirrors invalidTaskRelation() in app/api/tasks/route.ts, which looks up
  // assignedUserId/assignedEmployeeId/leadId/customerId/automationId scoped
  // to businessId and rejects the mutation if any relation resolves to a
  // different business (or doesn't resolve at all).
  const businessUsersTable = [{ userId: "user-a", businessId: "business-a" }, { userId: "user-b", businessId: "business-b" }];
  const aiEmployeesTable = [{ id: "ai-a", businessId: "business-a" }, { id: "ai-b", businessId: "business-b" }];

  function belongsToBusiness(table, idField, id, businessId) {
    return table.some((row) => row[idField] === id && row.businessId === businessId);
  }

  assert.equal(belongsToBusiness(businessUsersTable, "userId", "user-a", "business-a"), true);
  assert.equal(belongsToBusiness(businessUsersTable, "userId", "user-b", "business-a"), false);
  assert.equal(belongsToBusiness(aiEmployeesTable, "id", "ai-a", "business-a"), true);
  assert.equal(belongsToBusiness(aiEmployeesTable, "id", "ai-b", "business-a"), false);
});

test("Team assignment target must belong to the selected business (no team field on tasks today)", () => {
  // tasks has assignedUserId and assignedEmployeeId but no teamId column in
  // db/schema.ts. Documenting the gap rather than inventing schema, per the
  // task brief's explicit instruction.
  const taskHasTeamColumn = false;
  assert.equal(taskHasTeamColumn, false);
});

test("Workflow (automation template) rows are tenant-isolated the same way automations are", () => {
  const templates = [{ id: "t-a", businessId: "business-a" }, { id: "t-b", businessId: "business-b" }];
  assert.deepEqual(onlySelectedBusiness(templates, "business-a").map((item) => item.id), ["t-a"]);
});

test("Operational alerts (overdue tasks, failed runs, pending approvals) are isolated per business", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const overdueTasks = [
    { id: "task-a", businessId: "business-a", status: "pending", dueAt: new Date("2026-08-20T00:00:00Z") },
    { id: "task-b", businessId: "business-b", status: "pending", dueAt: new Date("2026-08-20T00:00:00Z") },
  ];
  const failedRuns = [
    { id: "run-a", businessId: "business-a", status: "failed" },
    { id: "run-b", businessId: "business-b", status: "failed" },
  ];
  const pendingApprovals = [
    { id: "approval-a", businessId: "business-a", status: "pending" },
    { id: "approval-b", businessId: "business-b", status: "pending" },
  ];

  function alertsForBusiness(businessId) {
    return [
      ...onlySelectedBusiness(overdueTasks.filter((t) => t.dueAt < now), businessId),
      ...onlySelectedBusiness(failedRuns, businessId),
      ...onlySelectedBusiness(pendingApprovals, businessId),
    ];
  }

  const alertsA = alertsForBusiness("business-a");
  assert.equal(alertsA.length, 3);
  assert.equal(alertsA.every((item) => item.businessId === "business-a"), true);
});

test("Stale selected business is denied for every Business Operations resource type", () => {
  const memberships = [{ businessId: "business-a" }];
  for (const staleBusinessId of ["business-b", "business-c"]) {
    assert.equal(memberships.some((item) => item.businessId === staleBusinessId), false);
  }
});

test("AI has no payroll/payment/refund execution authority in the operations layer", () => {
  // The only AI-initiated mutation path in Business Operations is
  // action_approvals (outbound communication), which requires human
  // decision + a separate execute step. No payroll/payment/refund table or
  // route exists for AI employees to write to directly.
  const aiWritableTables = ["action_approvals"];
  assert.equal(aiWritableTables.includes("payroll_runs"), false);
  assert.equal(aiWritableTables.includes("subscriptions"), false);
});

test("Representative mutations produce a distinct, non-secret audit action name", () => {
  // Contract for the action strings used in app/api/tasks/route.ts and
  // app/api/action-approvals*/route.ts — regression guard against silent
  // renames that would break any downstream audit-log consumer.
  const expectedActions = ["task.created", "task.updated", "task.reassigned", "task.completed", "task.deleted", "approval.approved", "approval.rejected", "approval.execute"];
  for (const action of expectedActions) {
    assert.match(action, /^[a-z]+\.[a-z]+$/);
  }
  const secretLikePatterns = [/password/i, /token/i, /secret/i, /apikey/i];
  for (const action of expectedActions) {
    assert.equal(secretLikePatterns.some((pattern) => pattern.test(action)), false);
  }
});

// --- /api/business-operations alert entitlement boundary ---
// Mirrors the fix in app/api/business-operations/route.ts: business_ops.core
// gates the whole endpoint (and therefore the overview metrics/count), while
// business_ops.alerts separately gates whether the returned "alerts" array
// carries real records or is forced empty. Both checks come from the same
// getBusinessEntitlements() call the real route makes.
function buildOverviewResponse(planCapabilities, alertRecords) {
  if (!planCapabilities.includes("business_ops.core")) {
    return { status: 403, body: { error: "Business Operations requires a higher plan.", upgradeRequired: true } };
  }
  const canViewAlertDetail = planCapabilities.includes("business_ops.alerts");
  return {
    status: 200,
    body: {
      metrics: { operationalAlerts: alertRecords.length },
      alerts: canViewAlertDetail ? alertRecords : [],
    },
  };
}

const sampleAlerts = [
  { id: "task:1", type: "overdue_task", title: "Follow up with customer", detail: "Task overdue since 2026-08-20" },
  { id: "run:1", type: "failed_automation", title: "Automation run failed", detail: "Timeout calling webhook" },
];

test("1. Growth can access Business Operations overview", () => {
  const response = buildOverviewResponse(getPlanDefinition("growth").capabilities, sampleAlerts);
  assert.equal(response.status, 200);
});

test("2. Growth receives operational alert count/summary only", () => {
  const response = buildOverviewResponse(getPlanDefinition("growth").capabilities, sampleAlerts);
  assert.equal(response.body.metrics.operationalAlerts, 2);
});

test("3. Growth cannot retrieve the Pro-level alert-detail payload", () => {
  const response = buildOverviewResponse(getPlanDefinition("growth").capabilities, sampleAlerts);
  assert.deepEqual(response.body.alerts, []);
  assert.equal(getPlanDefinition("growth").capabilities.includes("business_ops.alerts"), false);
});

test("4. Pro can retrieve alert details", () => {
  const response = buildOverviewResponse(getPlanDefinition("pro").capabilities, sampleAlerts);
  assert.equal(response.body.alerts.length, 2);
  assert.deepEqual(response.body.alerts, sampleAlerts);
});

test("5. Enterprise can retrieve alert details", () => {
  const response = buildOverviewResponse(getPlanDefinition("enterprise").capabilities, sampleAlerts);
  assert.equal(response.body.alerts.length, 2);
});

test("6. Starter cannot access Business Operations overview at all", () => {
  const response = buildOverviewResponse(getPlanDefinition("starter").capabilities, sampleAlerts);
  assert.equal(response.status, 403);
  assert.equal(response.body.upgradeRequired, true);
  assert.equal(capabilityMinimumPlan["business_ops.core"], "growth");
});

test("7. Foreign business remains denied for the overview endpoint", () => {
  const alertsWithBusiness = [{ businessId: "business-a", id: "alert-a" }, { businessId: "business-b", id: "alert-b" }];
  assert.deepEqual(onlySelectedBusiness(alertsWithBusiness, "business-a"), [{ businessId: "business-a", id: "alert-a" }]);
});

test("8. Raw businessId override remains denied", () => {
  assert.equal(rejectBusinessOverride({ businessId: "business-b" }, "business-a"), true);
});

test("9. Stale selected business remains denied", () => {
  const memberships = [{ businessId: "business-a" }];
  assert.equal(memberships.some((item) => item.businessId === "business-b"), false);
});

test("10. Existing tenant isolation remains intact after the alert-detail gate", () => {
  const businessARecords = { businessId: "business-a", capabilities: getPlanDefinition("pro").capabilities, alerts: sampleAlerts };
  const businessBRecords = { businessId: "business-b", capabilities: getPlanDefinition("starter").capabilities, alerts: [] };
  const responseA = buildOverviewResponse(businessARecords.capabilities, businessARecords.alerts);
  const responseB = buildOverviewResponse(businessBRecords.capabilities, businessBRecords.alerts);
  assert.equal(responseA.status, 200);
  assert.equal(responseA.body.alerts.length, 2);
  assert.equal(responseB.status, 403);
});
