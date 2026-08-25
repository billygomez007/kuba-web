import assert from "node:assert/strict";
import test from "node:test";
import { isResourceOwnedByBusiness, selectBusinessMembership } from "../lib/auth/business-context-policy.ts";
import { canUseKnowledgeSource } from "../lib/knowledge/access-policy.ts";

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

for (const resourceName of ["customer", "lead", "conversation", "message", "follow-up", "handoff"]) {
  test(`${resourceName} access is pinned to the selected business`, () => {
    const selected = selectBusinessMembership(memberships, "business-a");
    assert.ok(selected);
    assert.equal(isResourceOwnedByBusiness(selected.businessId, "business-a"), true);
    assert.equal(isResourceOwnedByBusiness(selected.businessId, "business-b"), false);
  });
}

test("a client businessId override cannot replace canonical selected context", () => {
  const selected = selectBusinessMembership(memberships, "business-a");
  const clientBody = { businessId: "business-b" };
  assert.equal(selected?.businessId, "business-a");
  assert.equal(isResourceOwnedByBusiness(selected.businessId, clientBody.businessId), false);
});

const sharedSourceA = { businessId: "business-a", employeeId: null };
const employeeSourceA = { businessId: "business-a", employeeId: "employee-a" };
const employeeSourceB = { businessId: "business-b", employeeId: "employee-b" };

test("Business A sees only its knowledge sources", () => {
  assert.equal(canUseKnowledgeSource("business-a", sharedSourceA), true);
  assert.equal(canUseKnowledgeSource("business-a", employeeSourceB), false);
});

test("Business B sees only its knowledge sources", () => {
  assert.equal(canUseKnowledgeSource("business-b", employeeSourceB), true);
  assert.equal(canUseKnowledgeSource("business-b", sharedSourceA), false);
});

test("foreign source IDs cannot cross the selected-business boundary", () => assert.equal(canUseKnowledgeSource("business-a", employeeSourceB), false));
test("foreign employee knowledge assignments are denied", () => assert.equal(canUseKnowledgeSource("business-a", employeeSourceA, "employee-b"), false));
test("employee retrieval includes shared and assigned sources", () => {
  assert.equal(canUseKnowledgeSource("business-a", sharedSourceA, "employee-a"), true);
  assert.equal(canUseKnowledgeSource("business-a", employeeSourceA, "employee-a"), true);
});
test("employee retrieval excludes another employee's dedicated source", () => assert.equal(canUseKnowledgeSource("business-a", employeeSourceA, "employee-b"), false));
test("knowledge search policy cannot return another business source", () => assert.equal(canUseKnowledgeSource("business-a", employeeSourceB, "employee-a"), false));
test("foreign customer memory remains outside selected context", () => assert.equal(isResourceOwnedByBusiness("business-a", "business-b"), false));
test("AI instructions never cross business context", () => {
  const settings = [{ businessId: "business-a", instructions: "A" }, { businessId: "business-b", instructions: "B" }];
  assert.deepEqual(settings.filter((item) => isResourceOwnedByBusiness("business-a", item.businessId)), [{ businessId: "business-a", instructions: "A" }]);
});
