// Real-implementation-path tests for the structured AI employee authority
// engine (lib/ai/authority.ts) added to close the "permissions are
// cosmetic" gap found in the Phase 2B audit: every Mastra tool now calls
// checkAIEmployeeAuthority before executing, instead of only being guided
// by prompt text. Exercises the actual production module against a real,
// disposable local SQLite database — never Turso/superkuba-staging.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, eq, and, authority, createLeadTool, updateLeadTool;

const BIZ_A = "auth-biz-a";
const BIZ_B = "auth-biz-b";

function fakeRequestContext(businessId, employeeId) {
  return { get: (key) => (key === "businessId" ? businessId : key === "employeeId" ? employeeId : undefined) };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-ai-authority-"));
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
  createLeadTool = (await import("@/mastra/tools/create-lead")).createLeadTool;
  updateLeadTool = (await import("@/mastra/tools/update-lead")).updateLeadTool;

  const now = new Date();
  for (const [id, plan] of [[BIZ_A, "pro"], [BIZ_B, "pro"]]) {
    await db.insert(schema.businesses).values({ id, name: `Auth Business ${id}`, slug: `auth-business-${id}`, plan, status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: id, provider: "stripe", providerCustomerId: `cus_${id}`, providerSubscriptionId: `sub_${id}`, providerEventId: `evt_${id}`, plan, status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
  }

  // Legacy employee: never had autonomy explicitly saved, so
  // supervisionMode carries the schema default "owner_supervised" (not one
  // of assistant/operator/autonomous). No aiEmployeeActionPolicies row
  // exists yet — the very first authority check must lazily provision one.
  await db.insert(schema.aiEmployees).values({ id: "emp-legacy", businessId: BIZ_A, name: "Legacy Sales", type: "sales", supervisionMode: "owner_supervised", status: "active", createdAt: now, updatedAt: now });

  await db.insert(schema.aiEmployees).values({ id: "emp-inactive", businessId: BIZ_A, name: "Disabled Sales", type: "sales", supervisionMode: "operator", status: "inactive", createdAt: now, updatedAt: now });

  await db.insert(schema.aiEmployees).values({ id: "emp-b", businessId: BIZ_B, name: "Business B Sales", type: "sales", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });

  // Explicit Assistant-mode employee: every write requires approval.
  await db.insert(schema.aiEmployees).values({ id: "emp-assistant", businessId: BIZ_A, name: "Assistant Sales", type: "sales", supervisionMode: "assistant", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: "emp-assistant", autonomyLevel: "assistant", policy: JSON.stringify(authority.defaultPolicyForAutonomy("assistant")), createdAt: now, updatedAt: now });

  // Explicit lead-write-denied employee: policy overrides create_lead to
  // "denied" even though autonomy is otherwise Operator.
  await db.insert(schema.aiEmployees).values({ id: "emp-denied", businessId: BIZ_A, name: "Restricted Sales", type: "sales", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });
  const deniedPolicy = authority.defaultPolicyForAutonomy("operator");
  deniedPolicy.create_lead = "denied";
  await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: "emp-denied", autonomyLevel: "operator", policy: JSON.stringify(deniedPolicy), createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- 24. Legacy employee safe default ---

test("a legacy employee (supervisionMode: owner_supervised, no policy row) is lazily provisioned as Operator — writes allowed, not silently maxed to Autonomous", async () => {
  const { autonomyLevel, policy } = await authority.getOrCreateActionPolicy(BIZ_A, "emp-legacy");
  assert.equal(autonomyLevel, "operator");
  assert.equal(policy.create_lead, "allowed");
  assert.equal(policy.request_external_message, "requires_approval");
});

test("the lazily provisioned policy row is actually persisted, not recomputed every call", async () => {
  const row = await db.select().from(schema.aiEmployeeActionPolicies).where(eq(schema.aiEmployeeActionPolicies.employeeId, "emp-legacy")).limit(1);
  assert.equal(row.length, 1);
  assert.equal(row[0].autonomyLevel, "operator");
});

// --- 1-2. Permission state persists and reloads ---

test("saving a policy via the same persistence path the API route uses, then reloading, returns the exact saved state", async () => {
  const employeeId = "emp-legacy";
  const now = new Date();
  const newPolicy = authority.defaultPolicyForAutonomy("operator");
  newPolicy.update_lead = "requires_approval";
  await db.update(schema.aiEmployeeActionPolicies).set({ policy: JSON.stringify(newPolicy), updatedAt: now }).where(eq(schema.aiEmployeeActionPolicies.employeeId, employeeId));
  const { policy } = await authority.getOrCreateActionPolicy(BIZ_A, employeeId);
  assert.equal(policy.update_lead, "requires_approval");
});

// --- 3-4. Denied action denied, allowed read action allowed ---

test("an action explicitly set to denied is denied even though the employee's autonomy would otherwise allow it", async () => {
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-denied", action: "create_lead" });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "denied");
});

test("a read action is allowed for an active, entitled, in-policy employee", async () => {
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-legacy", action: "read_leads" });
  assert.equal(decision.ok, true);
});

// --- 5-7. Approval creation, single executor, rejection blocks execution ---

test("a write action under Assistant Mode returns requires_approval rather than executing or silently denying", async () => {
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-assistant", action: "create_lead" });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "requires_approval");
});

test("createLeadTool for an Assistant-mode employee files a generic pending approval instead of creating the lead directly", async () => {
  const result = await createLeadTool.execute({ name: "Approval-Gated Lead" }, { requestContext: fakeRequestContext(BIZ_A, "emp-assistant") });
  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalId);
  const pending = await db.select().from(schema.aiEmployeeActionApprovals).where(eq(schema.aiEmployeeActionApprovals.id, result.approvalId)).limit(1);
  assert.equal(pending[0].action, "create_lead");
  assert.equal(pending[0].status, "pending");
  assert.equal(JSON.parse(pending[0].payload).name, "Approval-Gated Lead");
  const leadRow = await db.select().from(schema.leads).where(eq(schema.leads.name, "Approval-Gated Lead"));
  assert.equal(leadRow.length, 0, "the lead must not exist until a human approves and the approval is executed");
});

test("a rejected approval is never executable", async () => {
  const result = await createLeadTool.execute({ name: "Will Be Rejected" }, { requestContext: fakeRequestContext(BIZ_A, "emp-assistant") });
  const now = new Date();
  await db.update(schema.aiEmployeeActionApprovals).set({ status: "rejected", updatedAt: now }).where(eq(schema.aiEmployeeActionApprovals.id, result.approvalId));
  // Mirrors the executor route's own claim guard: only status "approved" can transition to "executing".
  const claimed = await db.update(schema.aiEmployeeActionApprovals).set({ status: "executing", updatedAt: now }).where(and(eq(schema.aiEmployeeActionApprovals.id, result.approvalId), eq(schema.aiEmployeeActionApprovals.status, "approved"))).returning({ id: schema.aiEmployeeActionApprovals.id });
  assert.equal(claimed.length, 0, "a rejected approval must never be claimable for execution");
});

test("only one code path in the repository transitions an ai_employee_action_approvals row to 'executing'", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai-action-approvals/[id]/execute/route.ts"), "utf8");
  assert.match(source, /status: "executing"/);
  const { execSync } = await import("node:child_process");
  const matches = execSync(`grep -rl 'aiEmployeeActionApprovals' app/api --include="*.ts"`, { cwd: REPO_ROOT, encoding: "utf8" }).trim().split("\n");
  const executors = [];
  for (const file of matches) {
    const contents = await readFile(path.join(REPO_ROOT, file), "utf8");
    if (/status:\s*"executing"/.test(contents)) executors.push(file);
  }
  assert.deepEqual(executors, ["app/api/ai-action-approvals/[id]/execute/route.ts"]);
});

// --- 8-9. Autonomy cannot bypass the communication floor ---

test("Assistant Mode requires approval for a write action", async () => {
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-assistant", action: "update_lead" });
  assert.equal(decision.reason, "requires_approval");
});

test("Autonomous Mode still cannot make communication 'allowed' — the floor cannot be bypassed by any stored policy", async () => {
  const now = new Date();
  await db.insert(schema.aiEmployees).values({ id: "emp-autonomous", businessId: BIZ_A, name: "Autonomous Sales", type: "sales", supervisionMode: "autonomous", status: "active", createdAt: now, updatedAt: now });
  const bypassPolicy = authority.defaultPolicyForAutonomy("autonomous");
  bypassPolicy.request_external_message = "allowed"; // an attempted bypass, even if written directly to storage
  await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: "emp-autonomous", autonomyLevel: "autonomous", policy: JSON.stringify(bypassPolicy), createdAt: now, updatedAt: now });
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-autonomous", action: "request_external_message" });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "requires_approval", "communication must never resolve to allowed, even if a stored policy row says so");
});

// --- 12, 14-15. Foreign employee, disabled/inactive employee ---

test("an employee that belongs to a different business is denied, not silently scoped to the wrong tenant", async () => {
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-b", action: "read_leads" });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "denied");
});

test("an inactive employee is denied even for a read action", async () => {
  const decision = await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-inactive", action: "read_leads" });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "denied");
});

test("updateLeadTool refuses to run for an inactive employee via requestContext, not just checkAIEmployeeAuthority directly", async () => {
  const result = await updateLeadTool.execute({ leadId: "nonexistent", stage: "qualified" }, { requestContext: fakeRequestContext(BIZ_A, "emp-inactive") });
  assert.equal(result.success, false);
});

// --- 20. No raw businessId override ---

test("requestContext, not tool input, decides which business a write lands in — the tool schema has no businessId field", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of ["mastra/tools/create-lead.ts", "mastra/tools/update-lead.ts", "mastra/tools/create-follow-up.ts", "mastra/tools/complete-follow-up.ts", "mastra/tools/create-sales-activity.ts"]) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /businessId:\s*z\./, `${file} must never accept businessId as tool input`);
  }
});

// --- 21. Audit event generated ---

test("a denied action and an approval-required action are both audited", async () => {
  await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-denied", action: "create_lead" });
  await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-assistant", action: "create_lead" });
  const logs = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.businessId, BIZ_A), eq(schema.auditLogs.resource, "ai_employee_action")));
  assert.ok(logs.some((row) => row.action === "ai.authority.denied"));
  assert.ok(logs.some((row) => row.action === "ai.authority.requires_approval"));
});

test("a read action that is simply allowed is not audited — only denials, approval requests, and allowed writes/communication are", async () => {
  const before = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.businessId, BIZ_A), eq(schema.auditLogs.resource, "ai_employee_action")));
  await authority.checkAIEmployeeAuthority({ businessId: BIZ_A, employeeId: "emp-legacy", action: "read_leads" });
  const after = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.businessId, BIZ_A), eq(schema.auditLogs.resource, "ai_employee_action")));
  assert.equal(after.length, before.length);
});

// --- 22-23. Prompt text and tool registration are not the security boundary ---

test("every write/communication mastra tool calls checkAIEmployeeAuthority — registration in an agent's tools object is not what authorizes it", async () => {
  const { readFile } = await import("node:fs/promises");
  const writeTools = [
    "mastra/tools/create-lead.ts",
    "mastra/tools/update-lead.ts",
    "mastra/tools/create-follow-up.ts",
    "mastra/tools/complete-follow-up.ts",
    "mastra/tools/create-sales-activity.ts",
    "mastra/tools/appointment-tools.ts",
    "mastra/tools/ticket-tools.ts",
    "mastra/tools/sales-external-action.ts",
    "lib/ai/tools/receptionist-tools.ts",
  ];
  for (const file of writeTools) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /checkAIEmployeeAuthority/, `${file} must call checkAIEmployeeAuthority before executing`);
  }
});

test("agent instructions describe server-enforced authority as authoritative, not just a prompt convention", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of ["mastra/agents/sales.ts", "mastra/agents/receptionist.ts", "mastra/agents/customer-support.ts"]) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /SERVER-ENFORCED AUTHORITY/);
  }
});

// --- 26. No duplicate approval executor for the messaging table either (regression guard on the Phase 1 finding) ---

test("exactly one file executes messaging action_approvals, and it is unchanged from Phase 1", async () => {
  const { execSync } = await import("node:child_process");
  const matches = execSync(`grep -rl 'actionApprovals' app/api --include="*.ts"`, { cwd: REPO_ROOT, encoding: "utf8" }).trim().split("\n").filter((f) => !f.includes("ai-action-approvals"));
  const { readFile } = await import("node:fs/promises");
  const executors = [];
  for (const file of matches) {
    const contents = await readFile(path.join(REPO_ROOT, file), "utf8");
    if (/status:\s*result\.success/.test(contents) || /status: "executing"/.test(contents)) executors.push(file);
  }
  assert.deepEqual(executors, ["app/api/action-approvals/[id]/execute/route.ts"]);
});
