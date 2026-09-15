// Real-implementation-path tests for the two newly-built AI employees
// (Marketing and Appointment) that close the "Coming Soon" gap in the
// approved Pro-tier AI Workforce catalog. Exercises the actual production
// tools/agents against a real, disposable local SQLite database — never
// Turso/superkuba-staging. Mirrors the conventions established in
// tests/ai-employee-authority.test.mjs.
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
let db, schema, eq;
let authority;
let createMarketingTaskTool, getMarketingPerformanceTool;
let getAppointmentsTool, createAppointmentTool;
let marketingTools, appointmentTools;

const BIZ_A = "mkt-appt-biz-a";
const BIZ_B = "mkt-appt-biz-b";

function fakeRequestContext(businessId, employeeId) {
  return { get: (key) => (key === "businessId" ? businessId : key === "employeeId" ? employeeId : undefined) };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-marketing-appointment-"));
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
  ({ eq } = await import("drizzle-orm"));
  authority = await import("@/lib/ai/authority");
  ({ createMarketingTaskTool } = await import("@/mastra/tools/marketing/create-marketing-task"));
  ({ getMarketingPerformanceTool } = await import("@/mastra/tools/marketing/get-marketing-performance"));
  ({ getAppointmentsTool, createAppointmentTool } = await import("@/mastra/tools/appointment-tools"));
  ({ marketingTools } = await import("@/mastra/agents/marketing"));
  ({ appointmentTools } = await import("@/mastra/agents/appointment"));

  const now = new Date();
  for (const id of [BIZ_A, BIZ_B]) {
    await db.insert(schema.businesses).values({ id, name: `Marketing/Appointment Business ${id}`, slug: `mkt-appt-${id}`, plan: "pro", status: "active", createdAt: now, updatedAt: now });
    // getBusinessEntitlements resolves the REAL plan from subscriptions,
    // never from the businesses.plan column directly — without this row
    // every entitlement (including customer_ops.ai_assist, which gates
    // read/create/update_appointment) silently falls back to Starter.
    await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: id, provider: "stripe", providerCustomerId: `cus_${id}`, providerSubscriptionId: `sub_${id}`, providerEventId: `evt_${id}`, plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
  }

  await db.insert(schema.aiEmployees).values({ id: "mkt-emp-a", businessId: BIZ_A, name: "Marketing A", type: "marketing", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployees).values({ id: "appt-emp-a", businessId: BIZ_A, name: "Appointment A", type: "appointment", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });

  await db.insert(schema.aiEmployees).values({ id: "mkt-emp-assistant", businessId: BIZ_A, name: "Assistant Marketing", type: "marketing", supervisionMode: "assistant", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: "mkt-emp-assistant", autonomyLevel: "assistant", policy: JSON.stringify(authority.defaultPolicyForAutonomy("assistant")), createdAt: now, updatedAt: now });

  // A real staff member to assign appointments to — validateReferences
  // correctly refuses an assignedUserId that isn't a genuine member of
  // this business, so the conflict-detection test below needs one.
  await db.insert(schema.users).values({ id: "staff-1", email: "staff-1@mkt-appt.example", name: "Staff One", emailVerified: true, status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.businessUsers).values({ id: crypto.randomUUID(), businessId: BIZ_A, userId: "staff-1", role: "member", createdAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Agent registration ---

test("the marketing agent exposes exactly the tools it's supposed to, all real functions", () => {
  for (const key of ["getBusinessKnowledge", "getLeads", "getFollowUps", "createFollowUp", "getMarketingPerformance", "createMarketingTask"]) {
    assert.ok(marketingTools[key], `expected marketingTools.${key} to be defined`);
    assert.equal(typeof marketingTools[key].execute, "function");
  }
});

test("the appointment agent exposes exactly the tools it's supposed to, all real functions", () => {
  for (const key of ["getBusinessKnowledge", "getAppointments", "createAppointment", "updateAppointment"]) {
    assert.ok(appointmentTools[key], `expected appointmentTools.${key} to be defined`);
    assert.equal(typeof appointmentTools[key].execute, "function");
  }
});

// --- create_marketing_task: authority + tenant isolation ---

test("createMarketingTask is allowed for an Operator-autonomy employee and persists a real, scoped task", async () => {
  const result = await createMarketingTaskTool.execute(
    { title: "Review Instagram carousel draft", priority: "high" },
    { requestContext: fakeRequestContext(BIZ_A, "mkt-emp-a") },
  );
  assert.equal(result.success, true);
  assert.equal(result.task.title, "Review Instagram carousel draft");

  const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.businessId, BIZ_A));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].assignedEmployeeId, "mkt-emp-a");
});

test("createMarketingTask requires approval for an Assistant-autonomy employee, and does not create the task yet", async () => {
  const result = await createMarketingTaskTool.execute(
    { title: "Design request for Q4 launch" },
    { requestContext: fakeRequestContext(BIZ_A, "mkt-emp-assistant") },
  );
  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalId);

  const approvalRows = await db.select().from(schema.aiEmployeeActionApprovals).where(eq(schema.aiEmployeeActionApprovals.id, result.approvalId));
  assert.equal(approvalRows.length, 1);
  assert.equal(approvalRows[0].action, "create_marketing_task");
});

test("TENANT ISOLATION: a marketing task created for business A is never visible under business B", async () => {
  await createMarketingTaskTool.execute(
    { title: "Business A only task" },
    { requestContext: fakeRequestContext(BIZ_A, "mkt-emp-a") },
  );
  const businessBTasks = await db.select().from(schema.tasks).where(eq(schema.tasks.businessId, BIZ_B));
  assert.equal(businessBTasks.length, 0);
});

test("REGRESSION: createMarketingTask never trusts a model-supplied businessId — it always comes from the trusted request context", async () => {
  const source = await readFile(path.join(REPO_ROOT, "mastra/tools/marketing/create-marketing-task.ts"), "utf8");
  assert.match(source, /requireBusinessId\(requestContext\)/);
  const schemaBlock = source.slice(
    source.indexOf("const createMarketingTaskInput"),
    source.indexOf("});", source.indexOf("const createMarketingTaskInput")),
  );
  assert.doesNotMatch(schemaBlock, /businessId/i, "the tool's own input schema must never accept a businessId field from the model");
});

// --- get-marketing-performance: honest "not connected" ---

test("getMarketingPerformance always returns connected: false and never fabricates a metric", async () => {
  const result = await getMarketingPerformanceTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "mkt-emp-a") });
  assert.equal(result.connected, false);
  assert.match(result.message, /not currently connected/i);
});

// --- appointment tools: authority, conflict detection, tenant isolation ---

test("createAppointment succeeds for an Operator-autonomy employee and getAppointments then returns it, scoped to the business", async () => {
  const created = await createAppointmentTool.execute(
    { title: "Consultation", startAt: "2027-01-10T09:00:00.000Z", endAt: "2027-01-10T09:30:00.000Z", timezone: "UTC" },
    { requestContext: fakeRequestContext(BIZ_A, "appt-emp-a") },
  );
  assert.equal(created.success, true);
  assert.ok(created.appointmentId);

  const listed = await getAppointmentsTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "appt-emp-a") });
  assert.ok(listed.appointments.some((appointment) => appointment.id === created.appointmentId));
});

test("createAppointment refuses a conflicting double-booking for the same business", async () => {
  await createAppointmentTool.execute(
    { title: "First booking", startAt: "2027-02-01T10:00:00.000Z", endAt: "2027-02-01T11:00:00.000Z", timezone: "UTC", assignedUserId: "staff-1" },
    { requestContext: fakeRequestContext(BIZ_A, "appt-emp-a") },
  );

  await assert.rejects(
    createAppointmentTool.execute(
      { title: "Conflicting booking", startAt: "2027-02-01T10:30:00.000Z", endAt: "2027-02-01T11:30:00.000Z", timezone: "UTC", assignedUserId: "staff-1" },
      { requestContext: fakeRequestContext(BIZ_A, "appt-emp-a") },
    ),
    /overlapping active appointment/i,
  );
});

test("TENANT ISOLATION: getAppointments for business B never returns business A's appointments, even with an identical title", async () => {
  await createAppointmentTool.execute(
    { title: "Shared Title", startAt: "2027-03-01T09:00:00.000Z", endAt: "2027-03-01T09:30:00.000Z", timezone: "UTC" },
    { requestContext: fakeRequestContext(BIZ_A, "appt-emp-a") },
  );

  await db.insert(schema.aiEmployees).values({ id: "appt-emp-b", businessId: BIZ_B, name: "Appointment B", type: "appointment", supervisionMode: "operator", status: "active", createdAt: new Date(), updatedAt: new Date() });
  const listedForB = await getAppointmentsTool.execute({}, { requestContext: fakeRequestContext(BIZ_B, "appt-emp-b") });
  assert.equal(listedForB.appointments.filter((appointment) => appointment.title === "Shared Title").length, 0);
});

// --- Route + entitlement wiring (static, matching the established
// next/headers-route-can't-be-invoked-directly convention) ---

for (const type of ["marketing", "appointment"]) {
  test(`REGRESSION: app/api/ai/${type}/route.ts enforces isEmployeeTypeEntitled BEFORE resolving the employee row`, async () => {
    const source = await readFile(path.join(REPO_ROOT, `app/api/ai/${type}/route.ts`), "utf8");
    const entitlementIndex = source.indexOf("isEmployeeTypeEntitled(");
    const employeeQueryIndex = source.indexOf("aiEmployees.type,");
    assert.ok(entitlementIndex > -1, `${type} route must call isEmployeeTypeEntitled`);
    assert.ok(entitlementIndex < employeeQueryIndex, "entitlement must be checked before the employee lookup");
    assert.match(source, new RegExp(`eq\\(aiEmployees\\.businessId, business\\.id\\)`));
    assert.match(source, new RegExp(`eq\\(aiEmployees\\.status, "active"\\)`));
  });
}
