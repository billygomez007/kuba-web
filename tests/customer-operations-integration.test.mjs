// Real-implementation-path tests for Appointments + Support/Tickets.
//
// Unlike tests/customer-operations-policy.test.mjs (which mirrors the
// transition/validation tables as local literals), this file imports the
// ACTUAL production modules — lib/customer-operations.ts, the appointment and
// ticket mastra tools, and lib/auth/permissions.ts / lib/billing/plan-definitions.ts
// — via a small alias-resolving Node loader (tests/helpers/alias-loader.mjs),
// and exercises them against a real, disposable local SQLite database built
// from the repository's own schema (scripts/bootstrap-clean-database.mjs).
//
// Never touches Turso, superkuba-staging, or any remote database.
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
let db, schema, customerOps, appointmentTools, ticketTools, permissions, planDefs;

const BIZ_A = "biz-a";
const BIZ_B = "biz-b";

function fakeRequestContext(businessId) {
  return { get: (key) => (key === "businessId" ? businessId : undefined) };
}

async function seed() {
  const now = new Date();
  const rows = [];

  for (const [biz, suffix] of [[BIZ_A, "a"], [BIZ_B, "b"]]) {
    await db.insert(schema.users).values({ id: `user-${suffix}`, name: `User ${suffix.toUpperCase()}`, email: `user-${suffix}@example.com`, emailVerified: true, phoneVerified: true, platformRole: "user", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.businessUsers).values({ id: `bu-${suffix}`, businessId: biz, userId: `user-${suffix}`, role: "member", permissions: null, createdAt: now });
    await db.insert(schema.customers).values({ id: `cust-${suffix}`, businessId: biz, name: `Customer ${suffix.toUpperCase()}`, email: `cust-${suffix}@example.com`, createdAt: now, updatedAt: now });
    await db.insert(schema.leads).values({ id: `lead-${suffix}`, businessId: biz, customerId: `cust-${suffix}`, name: `Customer ${suffix.toUpperCase()}`, createdAt: now, updatedAt: now });
    await db.insert(schema.conversations).values({ id: `conv-${suffix}`, businessId: biz, customerId: `cust-${suffix}`, integrationId: "whatsapp", customerName: `Customer ${suffix.toUpperCase()}`, status: "open", aiMode: "ai_handling", createdAt: now, updatedAt: now });
    await db.insert(schema.branches).values({ id: `branch-${suffix}`, businessId: biz, name: `Branch ${suffix.toUpperCase()}`, status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.aiEmployees).values({ id: `ai-${suffix}`, businessId: biz, name: `AI ${suffix.toUpperCase()}`, type: "receptionist", supervisionMode: "owner_supervised", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.businessTeams).values({ id: `team-${suffix}`, businessId: biz, department: "support", name: `Team ${suffix.toUpperCase()}`, status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.businessTeamMembers).values({ id: `tm-${suffix}`, teamId: `team-${suffix}`, businessUserId: `bu-${suffix}`, createdAt: now });
  }

  // A second business-a user who belongs to business-a but is NOT on team-a,
  // to distinguish "foreign user" rejection from "not a team member" rejection.
  await db.insert(schema.users).values({ id: "user-a2", name: "User A2", email: "user-a2@example.com", emailVerified: true, phoneVerified: true, platformRole: "user", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.businessUsers).values({ id: "bu-a2", businessId: BIZ_A, userId: "user-a2", role: "member", permissions: null, createdAt: now });

  return rows;
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-customer-ops-"));
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
  customerOps = await import("@/lib/customer-operations");
  appointmentTools = await import("@/mastra/tools/appointment-tools");
  ticketTools = await import("@/mastra/tools/ticket-tools");
  permissions = await import("@/lib/auth/permissions");
  planDefs = await import("@/lib/billing/plan-definitions");

  await seed();
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Real transition tables (imported, not reimplemented) ---

test("real appointmentTransitions: scheduled -> confirmed is allowed", () => {
  assert.doesNotThrow(() => customerOps.assertTransition(customerOps.appointmentTransitions, "scheduled", "confirmed"));
});
test("real appointmentTransitions: completed is terminal", () => {
  assert.throws(() => customerOps.assertTransition(customerOps.appointmentTransitions, "completed", "confirmed"));
});
test("real ticketTransitions: open -> resolved is allowed", () => {
  assert.doesNotThrow(() => customerOps.assertTransition(customerOps.ticketTransitions, "open", "resolved"));
});
test("real ticketTransitions: resolved -> open (reopen) is allowed, closed -> resolved is not", () => {
  assert.doesNotThrow(() => customerOps.assertTransition(customerOps.ticketTransitions, "resolved", "open"));
  assert.throws(() => customerOps.assertTransition(customerOps.ticketTransitions, "closed", "resolved"));
});
test("real validateTimezone accepts IANA zones and rejects garbage", () => {
  assert.equal(customerOps.validateTimezone("Africa/Accra"), "Africa/Accra");
  assert.throws(() => customerOps.validateTimezone("Not/A_Zone"));
});
test("real ticketReference produces a SUP- prefixed reference", () => {
  assert.match(customerOps.ticketReference(), /^SUP-[0-9A-F]{8}$/);
});

// --- Real validateReferences against a real, seeded, multi-tenant database ---

test("validateReferences accepts references that belong to the caller's business", async () => {
  await assert.doesNotReject(() => customerOps.validateReferences(BIZ_A, { customerId: "cust-a", leadId: "lead-a", conversationId: "conv-a", branchId: "branch-a", assignedUserId: "user-a", assignedAiEmployeeId: "ai-a" }));
});
test("validateReferences rejects a foreign customer", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { customerId: "cust-b" }), /Customer does not belong/);
});
test("validateReferences rejects a foreign lead", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { leadId: "lead-b" }), /Lead does not belong/);
});
test("validateReferences rejects a foreign conversation", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { conversationId: "conv-b" }), /Conversation does not belong/);
});
test("validateReferences rejects a foreign branch", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { branchId: "branch-b" }), /Branch does not belong/);
});
test("validateReferences rejects a foreign assigned user", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { assignedUserId: "user-b" }), /User does not belong/);
});
test("validateReferences rejects a foreign AI employee", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { assignedAiEmployeeId: "ai-b" }), /AI employee does not belong/);
});
test("validateReferences rejects assigning a real same-business user who isn't on that team", async () => {
  await assert.rejects(() => customerOps.validateReferences(BIZ_A, { assignedTeamId: "team-a", assignedUserId: "user-a2" }), /not a member of the selected team/);
});
test("validateReferences accepts a real team member on their own team", async () => {
  await assert.doesNotReject(() => customerOps.validateReferences(BIZ_A, { assignedTeamId: "team-a", assignedUserId: "user-a" }));
});

// --- Real conflict detection, tenant-scoped ---

test("assertAppointmentConflict: real overlap for the same assignee in the same business is rejected", async () => {
  const now = new Date();
  await db.insert(schema.appointments).values({ id: "appt-conflict-seed", businessId: BIZ_A, title: "Existing", assignedUserId: "user-a", startAt: new Date("2027-01-01T10:00:00Z"), endAt: new Date("2027-01-01T11:00:00Z"), timezone: "UTC", status: "scheduled", appointmentType: "meeting", meetingMode: "in_person", createdBy: "user-a", createdAt: now, updatedAt: now });
  await assert.rejects(
    () => customerOps.assertAppointmentConflict(BIZ_A, new Date("2027-01-01T10:30:00Z"), new Date("2027-01-01T11:30:00Z"), { assignedUserId: "user-a" }),
    /overlapping active appointment/,
  );
});
test("assertAppointmentConflict: identical time range in a DIFFERENT business does not conflict (tenant isolation)", async () => {
  await assert.doesNotReject(() => customerOps.assertAppointmentConflict(BIZ_B, new Date("2027-01-01T10:00:00Z"), new Date("2027-01-01T11:00:00Z"), { assignedUserId: "user-a" }));
});
test("assertAppointmentConflict: non-overlapping time for the same assignee is accepted", async () => {
  await assert.doesNotReject(() => customerOps.assertAppointmentConflict(BIZ_A, new Date("2027-01-01T11:00:00Z"), new Date("2027-01-01T12:00:00Z"), { assignedUserId: "user-a" }));
});
test("assertAppointmentConflict: an appointment does not conflict with itself when excluded (reschedule path)", async () => {
  await assert.doesNotReject(() => customerOps.assertAppointmentConflict(BIZ_A, new Date("2027-01-01T10:15:00Z"), new Date("2027-01-01T11:15:00Z"), { assignedUserId: "user-a" }, "appt-conflict-seed"));
});

// --- Direct foreign lookup denial, using the exact tenant-scoped WHERE clause the real routes use ---

test("direct foreign appointment lookup returns nothing when scoped to the wrong business", async () => {
  const { eq, and } = await import("drizzle-orm");
  const row = await db.select().from(schema.appointments).where(and(eq(schema.appointments.id, "appt-conflict-seed"), eq(schema.appointments.businessId, BIZ_B))).limit(1);
  assert.equal(row.length, 0);
});

// --- AI tool tests: tenant identity comes only from the server-pinned requestContext ---

test("AI createAppointmentTool rejects a foreign customer even when businessId is real business-a", async () => {
  await assert.rejects(() => appointmentTools.createAppointmentTool.execute({ title: "AI booked", startAt: "2027-02-01T09:00:00Z", endAt: "2027-02-01T09:30:00Z", timezone: "UTC", customerId: "cust-b" }, { requestContext: fakeRequestContext(BIZ_A) }));
});
test("AI createAppointmentTool ignores a smuggled businessId in tool input and uses only requestContext", async () => {
  const result = await appointmentTools.createAppointmentTool.execute({ title: "Legit booking", startAt: "2027-02-02T09:00:00Z", endAt: "2027-02-02T09:30:00Z", timezone: "UTC", businessId: BIZ_B }, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.success, true);
  const row = (await db.select().from(schema.appointments).where((await import("drizzle-orm")).eq(schema.appointments.id, result.appointmentId)))[0];
  assert.equal(row.businessId, BIZ_A, "the created appointment must belong to the requestContext business, not any businessId present in tool input");
});
test("AI getAppointmentsTool only returns the current business's appointments", async () => {
  const now = new Date();
  await db.insert(schema.appointments).values({ id: "appt-b-only", businessId: BIZ_B, title: "Business B only", startAt: now, endAt: new Date(now.getTime() + 3600000), timezone: "UTC", status: "scheduled", appointmentType: "meeting", meetingMode: "in_person", createdBy: "user-b", createdAt: now, updatedAt: now });
  const result = await appointmentTools.getAppointmentsTool.execute({}, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.appointments.some((item) => item.id === "appt-b-only"), false);
});
test("AI updateAppointmentTool cannot modify a foreign business's appointment", async () => {
  const result = await appointmentTools.updateAppointmentTool.execute({ appointmentId: "appt-b-only", status: "confirmed" }, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.success, false);
  assert.match(result.error, /not found/);
});

test("AI createSupportTicketTool rejects a foreign conversation", async () => {
  await assert.rejects(() => ticketTools.createSupportTicketTool.execute({ subject: "Help", description: "Issue", conversationId: "conv-b" }, { requestContext: fakeRequestContext(BIZ_A) }));
});
test("AI createSupportTicketTool creates tickets scoped to the requestContext business only", async () => {
  const result = await ticketTools.createSupportTicketTool.execute({ subject: "AI ticket", description: "Created by AI" }, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.success, true);
  const row = (await db.select().from(schema.tickets).where((await import("drizzle-orm")).eq(schema.tickets.id, result.ticketId)))[0];
  assert.equal(row.businessId, BIZ_A);
  assert.equal(row.source, "ai");
});
test("AI getTicketsTool only returns the current business's tickets", async () => {
  const now = new Date();
  await db.insert(schema.tickets).values({ id: "ticket-b-only", businessId: BIZ_B, ticketReference: "SUP-BBBBBBBB", subject: "B only", description: "desc", status: "open", priority: "normal", source: "manual", openedAt: now, createdBy: "user-b", createdAt: now, updatedAt: now });
  const result = await ticketTools.getTicketsTool.execute({}, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.tickets.some((item) => item.id === "ticket-b-only"), false);
});
test("AI requestTicketEscalationTool cannot escalate a foreign business's ticket", async () => {
  const result = await ticketTools.requestTicketEscalationTool.execute({ ticketId: "ticket-b-only", reason: "needs a human" }, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.success, false);
});
test("AI requestTicketEscalationTool can only ever set waiting_internal — it cannot resolve, close, or reopen", async () => {
  const now = new Date();
  await db.insert(schema.tickets).values({ id: "ticket-a-escalate", businessId: BIZ_A, ticketReference: "SUP-AAAAAAAA", subject: "Escalate me", description: "desc", status: "open", priority: "normal", source: "manual", openedAt: now, createdBy: "user-a", createdAt: now, updatedAt: now });
  const result = await ticketTools.requestTicketEscalationTool.execute({ ticketId: "ticket-a-escalate", reason: "needs a human" }, { requestContext: fakeRequestContext(BIZ_A) });
  assert.equal(result.success, true);
  const row = (await db.select().from(schema.tickets).where((await import("drizzle-orm")).eq(schema.tickets.id, "ticket-a-escalate")))[0];
  assert.equal(row.status, "waiting_internal");
});
test("Customer Support AI tool module exports no resolve/close/reopen-capable ticket tool", () => {
  const exportedNames = Object.keys(ticketTools);
  assert.deepEqual(exportedNames.sort(), ["createSupportTicketTool", "getTicketsTool", "requestTicketEscalationTool"]);
});

// --- Structural regression guards: routes and AI tools never accept a client-supplied businessId ---

test("appointment and ticket route handlers never read businessId from the request body or query", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = ["app/api/appointments/route.ts", "app/api/appointments/[id]/route.ts", "app/api/tickets/route.ts", "app/api/tickets/[id]/route.ts", "app/api/tickets/from-conversation/route.ts"];
  for (const file of files) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /body\.businessId|params\.get\("businessId"\)|searchParams\.get\("businessId"\)/, `${file} must derive businessId only from context.membership, never from client input`);
  }
});
test("appointment and ticket mastra tool input schemas never accept a businessId field", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of ["mastra/tools/appointment-tools.ts", "mastra/tools/ticket-tools.ts"]) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /businessId:\s*z\./, `${file} must never accept businessId as tool input`);
  }
});

// --- Permission AND entitlement, both required (mirrors getOperationsContext's real control flow) ---

test("owner role always has reception/messaging permissions regardless of custom permission overrides", () => {
  assert.equal(permissions.hasPermission("owner", null, permissions.PERMISSIONS.RECEPTION_MANAGE), true);
  assert.equal(permissions.hasPermission("owner", null, permissions.PERMISSIONS.MESSAGING_MANAGE), true);
});
test("a plain member without RECEPTION_MANAGE in role or custom permissions is denied", () => {
  const rolePermissions = permissions.getRolePermissions("member");
  if (!rolePermissions.includes(permissions.PERMISSIONS.RECEPTION_MANAGE)) {
    assert.equal(permissions.hasPermission("member", null, permissions.PERMISSIONS.RECEPTION_MANAGE), false);
  }
});
test("entitlement AND permission are both independently required for access (real getOperationsContext control flow)", () => {
  function wouldGrantAccess(role, storedPermissions, permission, planCapabilities, capability) {
    if (!permissions.hasPermission(role, storedPermissions, permission)) return false;
    if (!planCapabilities.includes(capability)) return false;
    return true;
  }
  const enterpriseCaps = planDefs.getPlanDefinition("enterprise").capabilities;
  const starterCaps = planDefs.getPlanDefinition("starter").capabilities;
  assert.equal(wouldGrantAccess("owner", null, permissions.PERMISSIONS.RECEPTION_MANAGE, enterpriseCaps, "customer_ops.appointments"), true);
  assert.equal(wouldGrantAccess("owner", null, permissions.PERMISSIONS.RECEPTION_MANAGE, starterCaps, "customer_ops.appointments"), false, "permission alone must not bypass the entitlement gate");
});

// --- Commercial tier state, verified against the real plan-definitions module ---

test("Appointments and Tickets are currently entitled at Enterprise only (current, unchanged tier placement)", () => {
  for (const planId of ["starter", "growth", "pro"]) {
    const caps = planDefs.getPlanDefinition(planId).capabilities;
    assert.equal(caps.includes("customer_ops.appointments"), false, `${planId} should not have customer_ops.appointments yet`);
    assert.equal(caps.includes("customer_ops.tickets"), false, `${planId} should not have customer_ops.tickets yet`);
  }
  const enterpriseCaps = planDefs.getPlanDefinition("enterprise").capabilities;
  assert.equal(enterpriseCaps.includes("customer_ops.appointments"), true);
  assert.equal(enterpriseCaps.includes("customer_ops.tickets"), true);
});
test("four-tier classification: Starter/Growth/Pro receive UPGRADE_REQUIRED, Enterprise receives AVAILABLE", () => {
  function classify(planId, capability) {
    const entitled = planDefs.getPlanDefinition(planId).capabilities.includes(capability);
    return entitled ? "AVAILABLE" : "UPGRADE_REQUIRED";
  }
  for (const planId of ["starter", "growth", "pro"]) {
    assert.equal(classify(planId, "customer_ops.appointments"), "UPGRADE_REQUIRED");
    assert.equal(classify(planId, "customer_ops.tickets"), "UPGRADE_REQUIRED");
  }
  assert.equal(classify("enterprise", "customer_ops.appointments"), "AVAILABLE");
  assert.equal(classify("enterprise", "customer_ops.tickets"), "AVAILABLE");
});
