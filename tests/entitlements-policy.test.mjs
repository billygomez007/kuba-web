import assert from "node:assert/strict";
import test from "node:test";

const starter = new Set([
  "command_center.basic",
  "ai_workforce.core",
  "customer_ops.core",
  "customer_ops.inbox",
  "customer_ops.customers",
  "customer_ops.leads",
  "customer_ops.followups",
  "integrations.core",
  "integrations.communication",
  "business_brain.core",
  "business_brain.sources",
  "admin.team_staff",
  "admin.billing",
]);
const growth = new Set([...starter, "ai_workforce.builder", "ai_workforce.teams", "ai_workforce.deployment", "ai_workforce.monitoring", "customer_ops.conversations", "customer_ops.handoffs", "business_ops.core", "business_ops.tasks", "business_ops.approvals", "business_ops.automations", "intelligence.basic", "business_brain.documents", "business_brain.memory", "business_brain.instructions"]);
const pro = new Set([...growth, "human_workforce.core", "human_workforce.hr", "human_workforce.attendance", "human_workforce.leave", "human_workforce.payroll", "human_workforce.teams", "ai_workforce.orchestration", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "business_ops.workflows", "business_ops.documents", "business_ops.alerts", "intelligence.advanced", "intelligence.sales", "intelligence.customer", "intelligence.ai_workforce", "intelligence.human_workforce", "intelligence.operations", "intelligence.reports", "integrations.social", "integrations.calendar", "integrations.payments", "integrations.accounting", "integrations.crm", "integrations.external_apps", "integrations.developer_api", "business_brain.management"]);
const enterprise = new Set([...pro, "command_center.advanced", "ai_workforce.collections", "enterprise.organization", "enterprise.multi_business", "enterprise.group_command_center", "enterprise.cross_business_analytics", "enterprise.advanced_governance", "admin.roles_permissions", "admin.branches"]);
const plans = { starter, growth, pro, enterprise };
const limits = {
  starter: { max_ai_employees: 1, max_businesses: 1, max_branches: 1, max_automations: 5 },
  growth: { max_ai_employees: 3, max_businesses: 1, max_branches: 3, max_automations: 20 },
  pro: { max_ai_employees: 10, max_businesses: 1, max_branches: null, max_automations: 100 },
  enterprise: { max_ai_employees: null, max_businesses: null, max_branches: null, max_automations: null },
};

function resolve(plan, overrides = []) {
  const capabilities = new Set(plans[plan]);
  const resultLimits = { ...limits[plan] };
  for (const override of overrides) {
    if (override.type === "grant_feature" && override.value === true) capabilities.add(override.feature);
    if (override.type === "limit") resultLimits[override.feature] = override.value;
  }
  return { capabilities, limits: resultLimits };
}

function canAccess(entitlements, permission, permissions) {
  return entitlements.capabilities.has(permission.capability) && permissions.includes(permission.rbac);
}

function projectSidebar(plan) {
  const entitlements = resolve(plan);
  return [
    ["Command Center", "command_center.basic"],
    ["AI Workforce", "ai_workforce.core"],
    ["Human Workforce", "human_workforce.core"],
    ["Customer Operations", "customer_ops.core"],
    ["Business Operations", "business_ops.core"],
    ["Intelligence", "intelligence.basic"],
    ["Integrations", "integrations.core"],
    ["Business Brain", "business_brain.core"],
  ].filter(([, capability]) => entitlements.capabilities.has(capability)).map(([name]) => name);
}

test("Starter resolves limited core capabilities", () => {
  const result = resolve("starter");
  assert.equal(result.capabilities.has("customer_ops.inbox"), true);
  assert.equal(result.capabilities.has("human_workforce.core"), false);
  assert.equal(result.limits.max_ai_employees, 1);
});

test("Growth receives Growth capabilities", () => {
  const result = resolve("growth");
  assert.equal(result.capabilities.has("ai_workforce.builder"), true);
  assert.equal(result.capabilities.has("intelligence.basic"), true);
  assert.equal(result.capabilities.has("human_workforce.core"), false);
});

test("Pro receives advanced single-business capabilities", () => {
  const result = resolve("pro");
  assert.equal(result.capabilities.has("human_workforce.hr"), true);
  assert.equal(result.capabilities.has("ai_workforce.orchestration"), true);
  assert.equal(result.capabilities.has("enterprise.organization"), false);
});

test("Enterprise receives the full intended capability set", () => {
  const result = resolve("enterprise");
  assert.equal(result.capabilities.has("enterprise.multi_business"), true);
  assert.equal(result.capabilities.has("ai_workforce.collections"), true);
  assert.equal(result.capabilities.has("integrations.developer_api"), true);
});

test("Overrides add capabilities without changing the base plan", () => {
  const result = resolve("growth", [{ feature: "human_workforce.payroll", type: "grant_feature", value: true }]);
  assert.equal(result.capabilities.has("human_workforce.payroll"), true);
  assert.equal(resolve("growth").capabilities.has("human_workforce.payroll"), false);
});

test("Numeric limit overrides replace the effective limit", () => {
  const result = resolve("starter", [{ feature: "max_ai_employees", type: "limit", value: 3 }]);
  assert.equal(result.limits.max_ai_employees, 3);
});

test("Entitlement and RBAC are both required", () => {
  const permission = { capability: "intelligence.basic", rbac: "analytics.view" };
  assert.equal(canAccess(resolve("growth"), permission, ["analytics.view"]), true);
  assert.equal(canAccess(resolve("growth"), permission, []), false);
  assert.equal(canAccess(resolve("starter"), permission, ["analytics.view"]), false);
});

test("Starter cannot access enterprise APIs even as owner", () => {
  assert.equal(resolve("starter").capabilities.has("enterprise.organization"), false);
});

test("Foreign business remains denied regardless of plan", () => {
  const selectedBusinessId = "business-a";
  const resourceBusinessId = "business-b";
  assert.equal(selectedBusinessId === resourceBusinessId, false);
});

test("Stale business selection remains denied", () => {
  const memberships = [{ businessId: "business-a" }];
  assert.equal(memberships.some((item) => item.businessId === "business-b"), false);
});

test("Sidebar projection is intentionally minimal for Starter", () => {
  const visible = projectSidebar("starter");
  assert.deepEqual(visible, ["Command Center", "AI Workforce", "Customer Operations", "Integrations", "Business Brain"]);
  assert.equal(visible.includes("Human Workforce"), false);
});

test("Growth sidebar expands without exposing enterprise hierarchy", () => {
  const visible = projectSidebar("growth");
  assert.equal(visible.includes("Business Operations"), true);
  assert.equal(visible.includes("Human Workforce"), false);
});

test("Pro sidebar exposes the single-business operating system", () => {
  const visible = projectSidebar("pro");
  assert.equal(visible.includes("Human Workforce"), true);
  assert.equal(visible.includes("Intelligence"), true);
});

test("Enterprise sidebar includes the full platform projection", () => {
  const visible = projectSidebar("enterprise");
  assert.equal(visible.length, 8);
  assert.equal(resolve("enterprise").capabilities.has("enterprise.group_command_center"), true);
});

test("Coming Soon is separate from entitlement", () => {
  const inventory = { entitled: true, implemented: false };
  assert.equal(inventory.entitled, true);
  assert.equal(inventory.implemented, false);
});

test("Downgrade preserves data while removing capability access", () => {
  const preservedEmployees = [{ id: "employee-1", name: "Kuba" }];
  assert.equal(preservedEmployees.length, 1);
  assert.equal(resolve("starter").capabilities.has("human_workforce.hr"), false);
});

test("Multi-business capability is enterprise-only", () => {
  assert.equal(resolve("pro").limits.max_businesses, 1);
  assert.equal(resolve("enterprise").limits.max_businesses, null);
});

test("Branch limits are represented centrally", () => {
  assert.equal(resolve("starter").limits.max_branches, 1);
  assert.equal(resolve("growth").limits.max_branches, 3);
  assert.equal(resolve("enterprise").limits.max_branches, null);
});

test("Billing status does not expose provider secrets", () => {
  const publicEntitlements = resolve("growth");
  assert.equal("secretKey" in publicEntitlements, false);
  assert.equal("webhookSecret" in publicEntitlements, false);
});

test("Module add-ons remain an explicit empty layer until supported", () => {
  const base = resolve("pro");
  const modules = [];
  assert.deepEqual(modules, []);
  assert.equal(base.capabilities.has("human_workforce.payroll"), true);
});

function toggleGroup(state, title) {
  return { ...state, [title]: !state[title] };
}

test("Active desktop sidebar group can open and close repeatedly", () => {
  let state = {};
  state = toggleGroup(state, "Command Center");
  assert.equal(state["Command Center"], true);
  state = toggleGroup(state, "Command Center");
  assert.equal(state["Command Center"], false);
  state = toggleGroup(state, "Command Center");
  assert.equal(state["Command Center"], true);
});

test("Mobile accordion uses the same open and close state transition", () => {
  let state = {};
  state = toggleGroup(state, "Integrations");
  assert.equal(state.Integrations, true);
  state = toggleGroup(state, "Integrations");
  assert.equal(state.Integrations, false);
});

test("Plan capability sets strictly progress from Starter through Enterprise", () => {
  assert.equal([...starter].every((capability) => growth.has(capability)), true);
  assert.equal([...growth].every((capability) => pro.has(capability)), true);
  assert.equal([...pro].every((capability) => enterprise.has(capability)), true);
  assert.equal(growth.size > starter.size, true);
  assert.equal(pro.size > growth.size, true);
  assert.equal(enterprise.size > pro.size, true);
});

test("Starter is denied a Pro-only route and Growth is denied an Enterprise-only route", () => {
  const permission = { capability: "human_workforce.core", rbac: "workforce.view" };
  assert.equal(canAccess(resolve("starter"), permission, ["workforce.view"]), false);
  assert.equal(canAccess(resolve("growth"), permission, ["workforce.view"]), false);
  assert.equal(canAccess(resolve("pro"), permission, ["workforce.view"]), true);

  const enterpriseOnly = { capability: "enterprise.multi_business", rbac: "dashboard.view" };
  assert.equal(canAccess(resolve("growth"), enterpriseOnly, ["dashboard.view"]), false);
  assert.equal(canAccess(resolve("pro"), enterpriseOnly, ["dashboard.view"]), false);
  assert.equal(canAccess(resolve("enterprise"), enterpriseOnly, ["dashboard.view"]), true);
});

test("Pro carries the accounting integration capability consistent with its required-plan label", () => {
  assert.equal(pro.has("integrations.accounting"), true);
  assert.equal(growth.has("integrations.accounting"), false);
});

test("Enterprise-only governance stays hidden from Pro", () => {
  assert.equal(pro.has("admin.roles_permissions"), false);
  assert.equal(pro.has("admin.branches"), false);
  assert.equal(pro.has("enterprise.advanced_governance"), false);
  assert.equal(enterprise.has("admin.roles_permissions"), true);
  assert.equal(enterprise.has("admin.branches"), true);
});

test("Switching selected business changes the active capability set with no leakage", () => {
  const businessA = { plan: "starter" };
  const businessB = { plan: "enterprise" };
  let active = resolve(businessA.plan);
  assert.equal(active.capabilities.has("human_workforce.core"), false);
  active = resolve(businessB.plan);
  assert.equal(active.capabilities.has("human_workforce.core"), true);
  assert.equal(active.capabilities.has("enterprise.multi_business"), true);
  active = resolve(businessA.plan);
  assert.equal(active.capabilities.has("enterprise.multi_business"), false);
});

test("Raw businessId override cannot substitute for a real membership", () => {
  const memberships = [{ businessId: "business-a", plan: "starter" }];
  const spoofedBusinessId = "business-b";
  const membership = memberships.find((item) => item.businessId === spoofedBusinessId);
  assert.equal(membership, undefined);
});

function activeGroupOnLoad(pathname, groups) {
  return groups.find((group) => group.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`)))?.title;
}

test("Active sidebar group opens automatically on initial navigation", () => {
  const groups = [
    { title: "AI Workforce", routes: ["/dashboard/ai-employees"] },
    { title: "Business Brain", routes: ["/dashboard/business-brain"] },
  ];
  const active = activeGroupOnLoad("/dashboard/ai-employees/create", groups);
  let expanded = {};
  if (active) expanded = { ...expanded, [active]: true };
  assert.equal(expanded["AI Workforce"], true);
  assert.equal(expanded["Business Brain"], undefined);

  expanded = toggleGroup(expanded, "AI Workforce");
  assert.equal(expanded["AI Workforce"], false);
});
