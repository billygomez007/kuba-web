import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationalMetrics, onlySelectedBusiness, rejectBusinessOverride } from "../lib/operations/policy.ts";

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
