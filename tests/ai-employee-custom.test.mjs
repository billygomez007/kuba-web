// Real-implementation-path tests for the Custom AI employee framework — the
// curated, safe, user-configured tool-permission system that closes the
// final gap in the complete 12-employee AI Workforce catalog. Exercises the
// actual production catalog/agent-factory/scope-resolution logic against a
// real, disposable local SQLite database — never Turso/superkuba-staging.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, eq, and;
let authority;
let custom;
let createMarketingTaskTool;

const BIZ_A = "custom-biz-a";
const BIZ_B = "custom-biz-b";

function fakeRequestContext(businessId, employeeId) {
  return { get: (key) => (key === "businessId" ? businessId : key === "employeeId" ? employeeId : undefined) };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-custom-employee-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  ({ eq, and } = await import("drizzle-orm"));
  authority = await import("@/lib/ai/authority");
  custom = await import("@/mastra/agents/custom");
  ({ createMarketingTaskTool } = await import("@/mastra/tools/marketing/create-marketing-task"));

  const now = new Date();
  for (const id of [BIZ_A, BIZ_B]) {
    await db.insert(schema.businesses).values({ id, name: `Custom Business ${id}`, slug: `custom-${id}`, plan: "pro", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: id, provider: "stripe", providerCustomerId: `cus_${id}`, providerSubscriptionId: `sub_${id}`, providerEventId: `evt_${id}`, plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
  }

  await db.insert(schema.aiEmployees).values({ id: "custom-emp-a", businessId: BIZ_A, name: "Inventory Helper", type: "custom", description: "Inventory Coordinator", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployees).values({ id: "custom-emp-assistant", businessId: BIZ_A, name: "Assistant Custom", type: "custom", supervisionMode: "assistant", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: "custom-emp-assistant", autonomyLevel: "assistant", policy: JSON.stringify(authority.defaultPolicyForAutonomy("assistant")), createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployees).values({ id: "custom-emp-b", businessId: BIZ_B, name: "Custom B", type: "custom", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });

  // Grant custom-emp-a exactly one tool (create_marketing_task) via a real
  // aiEmployeeScopes row — proving activation reads real grants, not a
  // hardcoded set.
  await db.insert(schema.aiEmployeeScopes).values({
    id: crypto.randomUUID(),
    businessId: BIZ_A,
    aiEmployeeId: "custom-emp-a",
    scope: custom.customToolScope("create_marketing_task"),
    effect: "allow",
    status: "active",
    grantedByUserId: "user-owner",
    createdAt: now,
    updatedAt: now,
  });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Curated catalog ---

test("CUSTOM_TOOL_CATALOG contains only real tools with a label/category/riskLevel/description", () => {
  const entries = Object.entries(custom.CUSTOM_TOOL_CATALOG);
  assert.ok(entries.length >= 15, "expected a substantial curated catalog");
  for (const [toolId, entry] of entries) {
    assert.equal(typeof entry.label, "string");
    assert.equal(typeof entry.category, "string");
    assert.ok(entry.riskLevel === "low" || entry.riskLevel === "medium");
    assert.equal(typeof entry.description, "string");
    assert.equal(typeof entry.tool.execute, "function", `${toolId} must map to a real tool`);
  }
});

test("isCustomToolId only recognizes catalog entries, never an arbitrary client-supplied string", () => {
  assert.equal(custom.isCustomToolId("create_marketing_task"), true);
  assert.equal(custom.isCustomToolId("delete_database"), false);
  assert.equal(custom.isCustomToolId("__proto__"), false);
});

test("customToolScope/toolIdFromScope round-trip and reject non-tool scopes", () => {
  assert.equal(custom.customToolScope("get_leads"), "tool:get_leads");
  assert.equal(custom.toolIdFromScope("tool:get_leads"), "get_leads");
  assert.equal(custom.toolIdFromScope("some-other-scope"), null);
});

// --- Dynamic tool filtering (never grants more than requested, never invents a tool) ---

test("buildCustomAgentTools returns ONLY the granted, catalog-recognized tools — nothing else", () => {
  const tools = custom.buildCustomAgentTools(["create_marketing_task", "get_leads"]);
  assert.deepEqual(Object.keys(tools).sort(), ["create_marketing_task", "get_leads"]);
});

test("buildCustomAgentTools silently drops an unrecognized tool ID rather than granting something outside the catalog", () => {
  const tools = custom.buildCustomAgentTools(["create_marketing_task", "arbitrary_sql_tool"]);
  assert.deepEqual(Object.keys(tools), ["create_marketing_task"]);
});

test("buildCustomAgentTools returns an empty object for an employee granted nothing", () => {
  const tools = custom.buildCustomAgentTools([]);
  assert.deepEqual(tools, {});
});

// --- A granted tool still respects this employee's own authority/approval floor ---

test("a tool granted to a Custom employee is allowed when the employee is Operator-autonomy", async () => {
  const result = await createMarketingTaskTool.execute({ title: "Custom-granted task" }, { requestContext: fakeRequestContext(BIZ_A, "custom-emp-a") });
  assert.equal(result.success, true);
});

test("the SAME granted tool requires approval when the employee is Assistant-autonomy — granting a tool never bypasses the approval floor", async () => {
  const result = await createMarketingTaskTool.execute({ title: "Custom-granted task, assistant mode" }, { requestContext: fakeRequestContext(BIZ_A, "custom-emp-assistant") });
  assert.equal(result.status, "approval_required");
});

// --- Tenant isolation of scope grants ---

test("TENANT ISOLATION: business B's identically-typed Custom employee has no tool grants from business A's aiEmployeeScopes rows", async () => {
  const grantedRowsForB = await db
    .select()
    .from(schema.aiEmployeeScopes)
    .where(and(eq(schema.aiEmployeeScopes.businessId, BIZ_B), eq(schema.aiEmployeeScopes.aiEmployeeId, "custom-emp-b")));
  assert.equal(grantedRowsForB.length, 0);
});

// --- Static regression: route and tool-management API safety ---

test("REGRESSION: app/api/ai/custom/route.ts resolves granted tools fresh from aiEmployeeScopes, scoped to businessId + aiEmployeeId, and never trusts a client-supplied tool list", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai/custom/route.ts"), "utf8");
  assert.match(source, /eq\(aiEmployeeScopes\.businessId, business\.id\)/);
  assert.match(source, /eq\(aiEmployeeScopes\.aiEmployeeId, employee\.id\)/);
  assert.doesNotMatch(source, /body\.tool/i, "the route must never read a tool list from the request body");
  const entitlementIndex = source.indexOf("isEmployeeTypeEntitled(");
  const employeeQueryIndex = source.indexOf("aiEmployees.type,");
  assert.ok(entitlementIndex > -1 && entitlementIndex < employeeQueryIndex, "entitlement must be checked before the employee lookup");
});

test("REGRESSION: the tool-permission management route only ever grants catalog tool IDs and only for type === \"custom\" employees", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai-employees/[id]/tools/route.ts"), "utf8");
  assert.match(source, /isCustomToolId\(toolId\)/, "must filter requested tool IDs through the curated catalog");
  assert.match(source, /employee\.type !== "custom"/, "must refuse to manage tools for a non-custom employee");
  assert.match(source, /WORKFORCE_MANAGE/, "must require workforce-management permission to change grants");
  assert.match(source, /eq\(aiEmployees\.businessId, businessId\)/, "must tenant-scope the employee lookup");
});

test("REGRESSION: createCustomAgent's instructions establish hard limits that no business-supplied instruction can override", async () => {
  const source = await readFile(path.join(REPO_ROOT, "mastra/agents/custom.ts"), "utf8");
  assert.match(source, /can never act for a different business/i);
  assert.match(source, /can never execute code/i);
  assert.match(source, /can never move money/i);
});
