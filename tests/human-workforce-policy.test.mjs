import assert from "node:assert/strict";
import test from "node:test";
import {
  canViewPayroll,
  filterWorkforceResources,
  ownsWorkforceResource,
  resolveSelectedWorkforceBusiness,
} from "../lib/human-workforce/policy.ts";

const rows = [
  { id: "ghana-1", businessId: "qa-ghana" },
  { id: "labs-1", businessId: "qa-labs" },
];

for (const resource of ["employee", "department", "position", "contract", "HR document", "attendance", "leave", "operational team", "payroll profile", "payroll run", "payslip"]) {
  test(`${resource} records are isolated to the selected business`, () => {
    assert.deepEqual(filterWorkforceResources(rows, "qa-ghana"), [rows[0]]);
    assert.equal(ownsWorkforceResource("qa-ghana", rows[1].businessId), false);
  });
}

test("foreign resource IDs are denied", () => {
  assert.equal(ownsWorkforceResource("qa-ghana", "qa-labs"), false);
});

test("a client businessId override cannot replace selected workforce context", () => {
  const selected = resolveSelectedWorkforceBusiness(
    [{ businessId: "qa-ghana", role: "owner", permissions: null }],
    "qa-ghana",
  );
  assert.equal(selected?.businessId, "qa-ghana");
  assert.equal(ownsWorkforceResource(selected.businessId, "qa-labs"), false);
});

test("stale selected business is denied", () => {
  assert.equal(resolveSelectedWorkforceBusiness([{ businessId: "qa-labs", role: "manager", permissions: null }], "qa-ghana"), null);
});

test("payroll requires both an authorized role and accounting view", () => {
  assert.equal(canViewPayroll("owner", ["accounting.view"]), true);
  assert.equal(canViewPayroll("accountant", ["accounting.view"]), true);
  assert.equal(canViewPayroll("manager", ["accounting.view"]), false);
  assert.equal(canViewPayroll("owner", ["workforce.view"]), false);
});
