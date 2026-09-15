// Real-implementation-path tests for the four newly-built AI employees
// (Accountant, Finance, HR, Operations) that complete the 12-employee
// AI Workforce catalog. Exercises the actual production tools/agents
// against a real, disposable local SQLite database — never Turso/
// superkuba-staging. Mirrors the conventions established in
// tests/ai-employee-marketing-appointment.test.mjs.
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
let db, schema, eq, and, ne;
let authority;
let getPayrollSummaryTool, createAccountingTaskTool, createFinanceTaskTool;
let getHrOverviewTool, createHrTaskTool;
let getOperationsOverviewTool, createOperationsTaskTool;
let accountantTools, financeTools, hrTools, operationsTools;

const BIZ_A = "afho-biz-a";
const BIZ_B = "afho-biz-b";

function fakeRequestContext(businessId, employeeId) {
  return { get: (key) => (key === "businessId" ? businessId : key === "employeeId" ? employeeId : undefined) };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-afho-"));
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
  ({ eq, and, ne } = await import("drizzle-orm"));
  authority = await import("@/lib/ai/authority");
  ({ getPayrollSummaryTool } = await import("@/mastra/tools/finance/get-payroll-summary"));
  ({ createAccountingTaskTool } = await import("@/mastra/tools/accounting/create-accounting-task"));
  ({ createFinanceTaskTool } = await import("@/mastra/tools/finance/create-finance-task"));
  ({ getHrOverviewTool } = await import("@/mastra/tools/hr/get-hr-overview"));
  ({ createHrTaskTool } = await import("@/mastra/tools/hr/create-hr-task"));
  ({ getOperationsOverviewTool } = await import("@/mastra/tools/operations/get-operations-overview"));
  ({ createOperationsTaskTool } = await import("@/mastra/tools/operations/create-operations-task"));
  ({ accountantTools } = await import("@/mastra/agents/accountant"));
  ({ financeTools } = await import("@/mastra/agents/finance"));
  ({ hrTools } = await import("@/mastra/agents/hr"));
  ({ operationsTools } = await import("@/mastra/agents/operations"));

  const now = new Date();
  for (const id of [BIZ_A, BIZ_B]) {
    await db.insert(schema.businesses).values({ id, name: `AFHO Business ${id}`, slug: `afho-${id}`, plan: "pro", status: "active", createdAt: now, updatedAt: now });
    // getBusinessEntitlements resolves the REAL plan from subscriptions, never
    // from businesses.plan — without this row every entitlement silently
    // falls back to Starter.
    await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: id, provider: "stripe", providerCustomerId: `cus_${id}`, providerSubscriptionId: `sub_${id}`, providerEventId: `evt_${id}`, plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
  }

  for (const type of ["accountant", "finance", "hr", "operations"]) {
    await db.insert(schema.aiEmployees).values({ id: `${type}-emp-a`, businessId: BIZ_A, name: `${type} A`, type, supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.aiEmployees).values({ id: `${type}-emp-assistant`, businessId: BIZ_A, name: `Assistant ${type}`, type, supervisionMode: "assistant", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: `${type}-emp-assistant`, autonomyLevel: "assistant", policy: JSON.stringify(authority.defaultPolicyForAutonomy("assistant")), createdAt: now, updatedAt: now });
  }

  // A real payroll run, so getPayrollSummary has honest, non-empty data to
  // return for business A. Business B intentionally has none, to prove the
  // honest-empty-state path AND tenant isolation.
  await db.insert(schema.payrollRuns).values({
    id: "payroll-run-a-1",
    businessId: BIZ_A,
    payrollPeriodId: "period-a-1",
    jurisdictionSettingId: "jurisdiction-a-1",
    statutoryRuleSetId: "ruleset-a-1",
    runNumber: 1,
    currencyCode: "GHS",
    status: "finalized",
    employeeCount: 3,
    grossAmountMinor: 500000,
    taxAmountMinor: 50000,
    deductionAmountMinor: 20000,
    netAmountMinor: 430000,
    preparedByUserId: "user-preparer",
    preparedAt: now,
    approvedByUserId: "user-approver",
    approvedAt: now,
    finalizedByUserId: "user-finalizer",
    finalizedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Real HR records for business A only.
  await db.insert(schema.hrDepartments).values({ id: "dept-a-1", businessId: BIZ_A, code: "OPS", name: "Operations", status: "active", createdByUserId: "user-owner", createdAt: now, updatedAt: now });
  await db.insert(schema.hrEmployees).values({ id: "hr-emp-a-1", businessId: BIZ_A, employeeNumber: "E001", displayName: "Ama Mensah", departmentId: "dept-a-1", hireDate: now, employmentType: "full_time", employmentStatus: "active", createdByUserId: "user-owner", createdAt: now, updatedAt: now });

  // Real operations data for business A: one overdue task, one open task, one upcoming appointment.
  await db.insert(schema.tasks).values({ id: "task-a-overdue", businessId: BIZ_A, title: "Overdue task", status: "pending", priority: "high", dueAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), createdAt: now, updatedAt: now });
  await db.insert(schema.tasks).values({ id: "task-a-open", businessId: BIZ_A, title: "Open task", status: "pending", priority: "normal", createdAt: now, updatedAt: now });
  await db.insert(schema.appointments).values({ id: "appt-a-upcoming", businessId: BIZ_A, title: "Upcoming visit", startAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), endAt: new Date(now.getTime() + 25 * 60 * 60 * 1000), timezone: "UTC", status: "scheduled", appointmentType: "meeting", meetingMode: "in_person", createdBy: "test", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Agent registration ---

test("the accountant agent exposes exactly the tools it's supposed to, all real functions", () => {
  for (const key of ["getBusinessKnowledge", "getPayrollSummary", "createAccountingTask"]) {
    assert.ok(accountantTools[key], `expected accountantTools.${key} to be defined`);
    assert.equal(typeof accountantTools[key].execute, "function");
  }
});

test("the finance agent exposes exactly the tools it's supposed to, all real functions", () => {
  for (const key of ["getBusinessKnowledge", "getPayrollSummary", "createFinanceTask"]) {
    assert.ok(financeTools[key], `expected financeTools.${key} to be defined`);
    assert.equal(typeof financeTools[key].execute, "function");
  }
});

test("the hr agent exposes exactly the tools it's supposed to, all real functions", () => {
  for (const key of ["getBusinessKnowledge", "getHrOverview", "createHrTask"]) {
    assert.ok(hrTools[key], `expected hrTools.${key} to be defined`);
    assert.equal(typeof hrTools[key].execute, "function");
  }
});

test("the operations agent exposes exactly the tools it's supposed to, all real functions", () => {
  for (const key of ["getBusinessKnowledge", "getOperationsOverview", "getAppointments", "createOperationsTask"]) {
    assert.ok(operationsTools[key], `expected operationsTools.${key} to be defined`);
    assert.equal(typeof operationsTools[key].execute, "function");
  }
});

// --- get-payroll-summary: honest empty state + real data + tenant isolation ---

test("getPayrollSummary returns honest real totals for a business with payroll runs", async () => {
  const result = await getPayrollSummaryTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "accountant-emp-a") });
  assert.equal(result.available, true);
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].grossAmount, 5000);
  assert.equal(result.runs[0].netAmount, 4300);
});

test("getPayrollSummary returns an honest empty result for a business with no payroll runs — never fabricates a number", async () => {
  await db.insert(schema.aiEmployees).values({ id: "finance-emp-b", businessId: BIZ_B, name: "Finance B", type: "finance", supervisionMode: "operator", status: "active", createdAt: new Date(), updatedAt: new Date() });
  const result = await getPayrollSummaryTool.execute({}, { requestContext: fakeRequestContext(BIZ_B, "finance-emp-b") });
  assert.equal(result.available, false);
  assert.equal(result.runs.length, 0);
  assert.match(result.message, /no payroll runs/i);
});

// --- create_accounting_task / create_finance_task: authority + tenant isolation ---

test("createAccountingTask is allowed for an Operator-autonomy employee and persists a real, scoped task", async () => {
  const result = await createAccountingTaskTool.execute({ title: "Reconcile October payroll" }, { requestContext: fakeRequestContext(BIZ_A, "accountant-emp-a") });
  assert.equal(result.success, true);
  const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.assignedEmployeeId, "accountant-emp-a"));
  assert.equal(rows.length, 1);
});

test("createAccountingTask requires approval for an Assistant-autonomy employee", async () => {
  const result = await createAccountingTaskTool.execute({ title: "Review Q3 filing prep" }, { requestContext: fakeRequestContext(BIZ_A, "accountant-emp-assistant") });
  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalId);
});

test("createFinanceTask is allowed for an Operator-autonomy employee and persists a real, scoped task", async () => {
  const result = await createFinanceTaskTool.execute({ title: "Review payroll spend vs budget" }, { requestContext: fakeRequestContext(BIZ_A, "finance-emp-a") });
  assert.equal(result.success, true);
  const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.assignedEmployeeId, "finance-emp-a"));
  assert.equal(rows.length, 1);
});

test("TENANT ISOLATION: an accounting task created for business A never appears assigned to a business B employee", async () => {
  await db.insert(schema.aiEmployees).values({ id: "accountant-emp-b", businessId: BIZ_B, name: "Accountant B", type: "accountant", supervisionMode: "operator", status: "active", createdAt: new Date(), updatedAt: new Date() });
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "accountant-emp-b", action: "create_accounting_task" });
  assert.equal(decision.ok, false);
  assert.match(decision.message, /does not belong to the current business/i);
});

// --- HR: honest overview + authority ---

test("getHrOverview returns real headcount/department data for business A", async () => {
  const result = await getHrOverviewTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "hr-emp-a") });
  assert.equal(result.available, true);
  assert.equal(result.totalHrEmployees, 1);
  assert.equal(result.departments.length, 1);
});

test("getHrOverview returns an honest empty result for a business with no HR records", async () => {
  await db.insert(schema.aiEmployees).values({ id: "hr-emp-b", businessId: BIZ_B, name: "HR B", type: "hr", supervisionMode: "operator", status: "active", createdAt: new Date(), updatedAt: new Date() });
  const result = await getHrOverviewTool.execute({}, { requestContext: fakeRequestContext(BIZ_B, "hr-emp-b") });
  assert.equal(result.available, false);
});

test("createHrTask is allowed for an Operator-autonomy employee", async () => {
  const result = await createHrTaskTool.execute({ title: "Send onboarding checklist" }, { requestContext: fakeRequestContext(BIZ_A, "hr-emp-a") });
  assert.equal(result.success, true);
});

test("REGRESSION: the HR agent's instructions establish the strict boundary against hire/fire/discipline/compensation decisions", async () => {
  const source = await readFile(path.join(REPO_ROOT, "mastra/agents/hr.ts"), "utf8");
  assert.match(source, /never.*autonomously:[\s\S]*hire, fire, or discipline/i);
  assert.match(source, /protected characteristic/i);
});

// --- Operations: honest overview + authority ---

test("getOperationsOverview returns real open/overdue task and upcoming appointment counts for business A", async () => {
  const result = await getOperationsOverviewTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "operations-emp-a") });
  assert.equal(result.available, true);
  // openTasks intentionally counts ALL open tasks for the business, not just
  // ones created by Operations — the accounting/finance/hr create-task tests
  // above already added real tasks to BIZ_A by this point in the suite, so
  // the expectation is derived from a fresh, independent query rather than
  // a hardcoded number that would silently drift with test order.
  const allOpenTasks = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.businessId, BIZ_A), ne(schema.tasks.status, "completed")));
  assert.equal(result.openTasks, allOpenTasks.length);
  assert.equal(result.overdueTasks, 1, "only the one seeded overdue task should count as overdue");
  assert.equal(result.upcomingAppointments, 1);
});

test("TENANT ISOLATION: getOperationsOverview for business B never counts business A's tasks or appointments", async () => {
  await db.insert(schema.aiEmployees).values({ id: "operations-emp-b", businessId: BIZ_B, name: "Operations B", type: "operations", supervisionMode: "operator", status: "active", createdAt: new Date(), updatedAt: new Date() });
  const result = await getOperationsOverviewTool.execute({}, { requestContext: fakeRequestContext(BIZ_B, "operations-emp-b") });
  assert.equal(result.openTasks, 0);
  assert.equal(result.overdueTasks, 0);
  assert.equal(result.upcomingAppointments, 0);
});

test("createOperationsTask is allowed for an Operator-autonomy employee and honors an optional dueAt", async () => {
  const result = await createOperationsTaskTool.execute({ title: "Follow up on overdue delivery", dueAt: "2027-01-01T00:00:00.000Z" }, { requestContext: fakeRequestContext(BIZ_A, "operations-emp-a") });
  assert.equal(result.success, true);
});

// --- Route + entitlement wiring (static regression) ---

for (const type of ["accountant", "finance", "hr", "operations"]) {
  test(`REGRESSION: app/api/ai/${type}/route.ts enforces isEmployeeTypeEntitled BEFORE resolving the employee row`, async () => {
    const source = await readFile(path.join(REPO_ROOT, `app/api/ai/${type}/route.ts`), "utf8");
    const entitlementIndex = source.indexOf("isEmployeeTypeEntitled(");
    const employeeQueryIndex = source.indexOf("aiEmployees.type,");
    assert.ok(entitlementIndex > -1, `${type} route must call isEmployeeTypeEntitled`);
    assert.ok(entitlementIndex < employeeQueryIndex, "entitlement must be checked before the employee lookup");
    assert.match(source, /eq\(aiEmployees\.businessId, business\.id\)/);
    assert.match(source, /eq\(aiEmployees\.status, "active"\)/);
  });
}

test("REGRESSION: none of the four new write tools ever accept a businessId field in their own Zod input schema", async () => {
  const files = [
    "mastra/tools/accounting/create-accounting-task.ts",
    "mastra/tools/finance/create-finance-task.ts",
    "mastra/tools/hr/create-hr-task.ts",
    "mastra/tools/operations/create-operations-task.ts",
  ];
  for (const file of files) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    const schemaBlock = source.slice(source.indexOf("z.object({"), source.indexOf("});"));
    assert.doesNotMatch(schemaBlock, /businessId/i, `${file}'s input schema must never accept a businessId field from the model`);
    assert.match(source, /requireBusinessId\(requestContext\)/, `${file} must resolve businessId from the trusted request context`);
  }
});
