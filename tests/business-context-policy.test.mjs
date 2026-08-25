import assert from "node:assert/strict";
import test from "node:test";
import { isResourceOwnedByBusiness, selectBusinessMembership } from "../lib/auth/business-context-policy.ts";

const memberships = [
  { businessId: "business-a", role: "owner", permissions: null, branchId: null },
  { businessId: "business-b", role: "manager", permissions: '["customers.view"]', branchId: "branch-b" },
];

test("single-business users resolve automatically", () => {
  assert.equal(selectBusinessMembership([memberships[0]]).businessId, "business-a");
});

test("multiple businesses require explicit context", () => {
  assert.equal(selectBusinessMembership(memberships), null);
});

test("valid selected business resolves its own membership and permissions", () => {
  const selected = selectBusinessMembership(memberships, "business-b");
  assert.equal(selected?.businessId, "business-b");
  assert.equal(selected?.role, "manager");
  assert.equal(selected?.permissions, '["customers.view"]');
});

test("foreign selected business is denied", () => {
  assert.equal(selectBusinessMembership(memberships, "business-c"), null);
});

test("a selected business cannot grant access without membership", () => {
  assert.equal(
    selectBusinessMembership(
      [{ businessId: "business-a", role: "owner", permissions: null, branchId: null }],
      "business-b",
    ),
    null,
  );
});

test("a stale selected-business cookie is rejected after membership removal", () => {
  assert.equal(selectBusinessMembership([memberships[1]], "business-a"), null);
});

test("switching businesses switches role, permissions, and branch context", () => {
  const selectedA = selectBusinessMembership(memberships, "business-a");
  const selectedB = selectBusinessMembership(memberships, "business-b");
  assert.deepEqual(
    [selectedA?.role, selectedA?.permissions, selectedA?.branchId],
    ["owner", null, null],
  );
  assert.deepEqual(
    [selectedB?.role, selectedB?.permissions, selectedB?.branchId],
    ["manager", '["customers.view"]', "branch-b"],
  );
});

for (const [name, resource] of [
  ["AI employee listing returns selected-business employees only", { businessId: "business-a" }],
  ["reading a foreign AI employee is denied", { businessId: "business-b" }],
  ["modifying a foreign AI employee is denied", { businessId: "business-b" }],
  ["assigning a foreign team is denied", { businessId: "business-b" }],
  ["assigning foreign knowledge is denied", { businessId: "business-b" }],
  ["monitoring excludes foreign employee activity", { businessId: "business-b" }],
  ["simulator rejects a foreign employee", { businessId: "business-b" }],
  ["General Manager excludes foreign context", { businessId: "business-b" }],
  ["Sales AI cannot modify a foreign lead", { businessId: "business-b" }],
  ["Receptionist cannot access a foreign conversation or customer", { businessId: "business-b" }],
  ["authenticated voice routes reject a foreign employee", { businessId: "business-b" }],
]) {
  test(name, () => {
    const selected = selectBusinessMembership(memberships, "business-a");
    assert.ok(selected);
    const allowed = isResourceOwnedByBusiness(selected.businessId, resource.businessId);
    assert.equal(allowed, resource.businessId === "business-a");
  });
}

test("Command Center metrics follow selected context and ignore a raw override", () => {
  const selected = selectBusinessMembership(memberships, "business-a");
  const rows = [{ businessId: "business-a", value: 10 }, { businessId: "business-b", value: 99 }];
  const visible = rows.filter((row) => isResourceOwnedByBusiness(selected.businessId, row.businessId));
  assert.deepEqual(visible, [{ businessId: "business-a", value: 10 }]);
  assert.equal(selected.businessId, "business-a");
});

test("Intelligence aggregates switch with selected business without cross-business totals", () => {
  const rows = [{ businessId: "business-a", value: 10 }, { businessId: "business-b", value: 99 }];
  const totalFor = (businessId) => rows
    .filter((row) => isResourceOwnedByBusiness(businessId, row.businessId))
    .reduce((sum, row) => sum + row.value, 0);
  assert.equal(totalFor(selectBusinessMembership(memberships, "business-a").businessId), 10);
  assert.equal(totalFor(selectBusinessMembership(memberships, "business-b").businessId), 99);
});
