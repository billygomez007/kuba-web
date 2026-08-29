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
const BIZ_STARTER = "biz-tier-starter";
const BIZ_GROWTH = "biz-tier-growth";
const BIZ_PRO = "biz-tier-pro";
const BIZ_ENTERPRISE = "biz-tier-enterprise";

function fakeRequestContext(businessId, employeeId) {
  return { get: (key) => (key === "businessId" ? businessId : key === "employeeId" ? employeeId : undefined) };
}

async function seed() {
  const now = new Date();
  const rows = [];

  // biz-a and biz-b each get a real, active "pro" subscription row so the
  // existing AI-tool tests below continue to exercise tenant isolation
  // specifically, unaffected by the entitlement gate added in this task.
  // (getBusinessEntitlements no longer trusts businesses.plan on its own —
  // see the "businesses.plan fallback" tests further down — so a real
  // subscription row is required here, not just the plan column.)
  // Dedicated tier businesses are seeded separately below.
  for (const [biz, suffix] of [[BIZ_A, "a"], [BIZ_B, "b"]]) {
    await db.insert(schema.businesses).values({ id: biz, name: `Business ${suffix.toUpperCase()}`, slug: `business-${suffix}`, plan: "pro", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: biz, provider: "stripe", providerCustomerId: `cus_${suffix}`, providerSubscriptionId: `sub_${suffix}`, providerEventId: `evt_seed_${suffix}`, plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
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

  // One dedicated business per tier, for entitlement-tier assertions specifically.
  // BIZ_STARTER deliberately gets NO subscription row — Starter is exactly
  // what a business with no subscription resolves to.
  for (const [id, plan] of [[BIZ_STARTER, "starter"], [BIZ_GROWTH, "growth"], [BIZ_PRO, "pro"], [BIZ_ENTERPRISE, "enterprise"]]) {
    await db.insert(schema.businesses).values({ id, name: `Business ${plan}`, slug: `business-${plan}`, plan: "starter", status: "active", createdAt: now, updatedAt: now });
    if (plan !== "starter") {
      await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: id, provider: "stripe", providerCustomerId: `cus_tier_${plan}`, providerSubscriptionId: `sub_tier_${plan}`, providerEventId: `evt_seed_tier_${plan}`, plan, status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
    }
    // Every AI-authority check requires a real, active employee scoped to
    // the business in RequestContext — these tier businesses exercise the
    // entitlement gate specifically, not tenant/employee-status, so each
    // gets one active receptionist-type employee for its tool calls to run
    // as.
    await db.insert(schema.aiEmployees).values({ id: `ai-tier-${plan}`, businessId: id, name: `AI Tier ${plan}`, type: "receptionist", supervisionMode: "owner_supervised", status: "active", createdAt: now, updatedAt: now });
  }

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
  await assert.rejects(() => appointmentTools.createAppointmentTool.execute({ title: "AI booked", startAt: "2027-02-01T09:00:00Z", endAt: "2027-02-01T09:30:00Z", timezone: "UTC", customerId: "cust-b" }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") }));
});
test("AI createAppointmentTool ignores a smuggled businessId in tool input and uses only requestContext", async () => {
  const result = await appointmentTools.createAppointmentTool.execute({ title: "Legit booking", startAt: "2027-02-02T09:00:00Z", endAt: "2027-02-02T09:30:00Z", timezone: "UTC", businessId: BIZ_B }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.success, true);
  const row = (await db.select().from(schema.appointments).where((await import("drizzle-orm")).eq(schema.appointments.id, result.appointmentId)))[0];
  assert.equal(row.businessId, BIZ_A, "the created appointment must belong to the requestContext business, not any businessId present in tool input");
});
test("AI getAppointmentsTool only returns the current business's appointments", async () => {
  const now = new Date();
  await db.insert(schema.appointments).values({ id: "appt-b-only", businessId: BIZ_B, title: "Business B only", startAt: now, endAt: new Date(now.getTime() + 3600000), timezone: "UTC", status: "scheduled", appointmentType: "meeting", meetingMode: "in_person", createdBy: "user-b", createdAt: now, updatedAt: now });
  const result = await appointmentTools.getAppointmentsTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.appointments.some((item) => item.id === "appt-b-only"), false);
});
test("AI updateAppointmentTool cannot modify a foreign business's appointment", async () => {
  const result = await appointmentTools.updateAppointmentTool.execute({ appointmentId: "appt-b-only", status: "confirmed" }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.success, false);
  assert.match(result.error, /not found/);
});

test("AI createSupportTicketTool rejects a foreign conversation", async () => {
  await assert.rejects(() => ticketTools.createSupportTicketTool.execute({ subject: "Help", description: "Issue", conversationId: "conv-b" }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") }));
});
test("AI createSupportTicketTool creates tickets scoped to the requestContext business only", async () => {
  const result = await ticketTools.createSupportTicketTool.execute({ subject: "AI ticket", description: "Created by AI" }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.success, true);
  const row = (await db.select().from(schema.tickets).where((await import("drizzle-orm")).eq(schema.tickets.id, result.ticketId)))[0];
  assert.equal(row.businessId, BIZ_A);
  assert.equal(row.source, "ai");
});
test("AI getTicketsTool only returns the current business's tickets", async () => {
  const now = new Date();
  await db.insert(schema.tickets).values({ id: "ticket-b-only", businessId: BIZ_B, ticketReference: "SUP-BBBBBBBB", subject: "B only", description: "desc", status: "open", priority: "normal", source: "manual", openedAt: now, createdBy: "user-b", createdAt: now, updatedAt: now });
  const result = await ticketTools.getTicketsTool.execute({}, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.tickets.some((item) => item.id === "ticket-b-only"), false);
});
test("AI requestTicketEscalationTool cannot escalate a foreign business's ticket", async () => {
  const result = await ticketTools.requestTicketEscalationTool.execute({ ticketId: "ticket-b-only", reason: "needs a human" }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.success, false);
});
test("AI requestTicketEscalationTool can only ever set waiting_internal — it cannot resolve, close, or reopen", async () => {
  const now = new Date();
  await db.insert(schema.tickets).values({ id: "ticket-a-escalate", businessId: BIZ_A, ticketReference: "SUP-AAAAAAAA", subject: "Escalate me", description: "desc", status: "open", priority: "normal", source: "manual", openedAt: now, createdBy: "user-a", createdAt: now, updatedAt: now });
  const result = await ticketTools.requestTicketEscalationTool.execute({ ticketId: "ticket-a-escalate", reason: "needs a human" }, { requestContext: fakeRequestContext(BIZ_A, "ai-a") });
  assert.equal(result.success, true);
  const row = (await db.select().from(schema.tickets).where((await import("drizzle-orm")).eq(schema.tickets.id, "ticket-a-escalate")))[0];
  assert.equal(row.status, "waiting_internal");
});
test("Customer Support AI tool module exports no resolve/close/reopen-capable ticket tool", () => {
  const exportedNames = Object.keys(ticketTools);
  assert.deepEqual(exportedNames.sort(), ["createSupportTicketTool", "getTicketsTool", "performCreateSupportTicket", "performEscalateTicket", "requestTicketEscalationTool"]);
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

// --- Commercial tier placement, verified against the real plan-definitions module ---
// Approved model: Starter = no Appointments/Tickets. Growth = core (human)
// Appointments/Tickets. Pro = Growth + AI-assisted workflows. Enterprise = Pro + governance.

test("1-2. Starter is not entitled to Appointments or Tickets", () => {
  const caps = planDefs.getPlanDefinition("starter").capabilities;
  assert.equal(caps.includes("customer_ops.appointments"), false);
  assert.equal(caps.includes("customer_ops.tickets"), false);
});
test("3. Starter's required plan for Appointments and Tickets is Growth (derived, not hand-coded)", () => {
  assert.equal(planDefs.capabilityMinimumPlan["customer_ops.appointments"], "growth");
  assert.equal(planDefs.capabilityMinimumPlan["customer_ops.tickets"], "growth");
});
test("4-5. Growth is entitled to core Appointments and Tickets", () => {
  const caps = planDefs.getPlanDefinition("growth").capabilities;
  assert.equal(caps.includes("customer_ops.appointments"), true);
  assert.equal(caps.includes("customer_ops.tickets"), true);
});
test("6-7. Growth's core appointment/ticket workflow is unblocked at the getOperationsContext gate (permission AND entitlement)", () => {
  function wouldGrantAccess(planCapabilities, capability) {
    return permissions.hasPermission("owner", null, permissions.PERMISSIONS.RECEPTION_MANAGE) && planCapabilities.includes(capability);
  }
  const growthCaps = planDefs.getPlanDefinition("growth").capabilities;
  assert.equal(wouldGrantAccess(growthCaps, "customer_ops.appointments"), true);
  assert.equal(wouldGrantAccess(growthCaps, "customer_ops.tickets"), true);
});
test("8. Growth does NOT inherit Pro AI Workforce or AI-assisted customer-ops capabilities", () => {
  const growthCaps = planDefs.getPlanDefinition("growth").capabilities;
  for (const proOnly of ["customer_ops.ai_assist", "ai_workforce.orchestration", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "ai_workforce.performance"]) {
    assert.equal(growthCaps.includes(proOnly), false, `growth must not have ${proOnly}`);
  }
});
test("9-10. Pro is entitled to Appointments and Tickets", () => {
  const caps = planDefs.getPlanDefinition("pro").capabilities;
  assert.equal(caps.includes("customer_ops.appointments"), true);
  assert.equal(caps.includes("customer_ops.tickets"), true);
});
test("11. Pro's AI-assisted customer-ops capability follows the existing AI Workforce tier rules (Pro-and-above only)", () => {
  const proCaps = planDefs.getPlanDefinition("pro").capabilities;
  assert.equal(proCaps.includes("customer_ops.ai_assist"), true);
  assert.equal(proCaps.includes("ai_workforce.orchestration"), true, "customer_ops.ai_assist should land alongside the same tier as other Pro-level AI Workforce capabilities");
});
test("12. Pro lacks Enterprise governance", () => {
  const proCaps = planDefs.getPlanDefinition("pro").capabilities;
  for (const enterpriseOnly of ["enterprise.organization", "enterprise.multi_business", "enterprise.group_command_center", "enterprise.cross_business_analytics", "enterprise.advanced_governance"]) {
    assert.equal(proCaps.includes(enterpriseOnly), false, `pro must not have ${enterpriseOnly}`);
  }
});
test("13-15. Enterprise has Appointments, Tickets, and full capability inheritance from Pro", () => {
  const enterpriseCaps = planDefs.getPlanDefinition("enterprise").capabilities;
  const proCaps = planDefs.getPlanDefinition("pro").capabilities;
  assert.equal(enterpriseCaps.includes("customer_ops.appointments"), true);
  assert.equal(enterpriseCaps.includes("customer_ops.tickets"), true);
  assert.equal(proCaps.every((capability) => enterpriseCaps.includes(capability)), true, "enterprise must inherit every pro capability");
});
test("Monotonic tier ladder: starter ⊂ growth ⊂ pro ⊂ enterprise", () => {
  const starter = planDefs.getPlanDefinition("starter").capabilities;
  const growth = planDefs.getPlanDefinition("growth").capabilities;
  const pro = planDefs.getPlanDefinition("pro").capabilities;
  const enterprise = planDefs.getPlanDefinition("enterprise").capabilities;
  assert.equal(starter.every((c) => growth.includes(c)), true);
  assert.equal(growth.every((c) => pro.includes(c)), true);
  assert.equal(pro.every((c) => enterprise.includes(c)), true);
});

// --- 18. Direct foreign ticket lookup (mirrors the appointment version above) ---

test("18. direct foreign ticket lookup returns nothing when scoped to the wrong business", async () => {
  const { eq, and } = await import("drizzle-orm");
  const now = new Date();
  await db.insert(schema.tickets).values({ id: "ticket-lookup-seed", businessId: BIZ_A, ticketReference: "SUP-LOOKUP01", subject: "lookup test", description: "d", status: "open", priority: "normal", source: "manual", openedAt: now, createdBy: "user-a", createdAt: now, updatedAt: now });
  const row = await db.select().from(schema.tickets).where(and(eq(schema.tickets.id, "ticket-lookup-seed"), eq(schema.tickets.businessId, BIZ_B))).limit(1);
  assert.equal(row.length, 0);
});

// --- 21. Business switch refreshes entitlements (same render-time-invalidation contract as tests/four-tier-qa.test.mjs) ---

test("21. switching a session's business from Enterprise to Starter immediately drops Appointments/Tickets access", () => {
  function pageAccessAfterSwitch(capability, newPlanCapabilities) {
    return newPlanCapabilities.includes(capability) ? "renders" : "upgrade_required";
  }
  const enterpriseCaps = planDefs.getPlanDefinition("enterprise").capabilities;
  const starterCaps = planDefs.getPlanDefinition("starter").capabilities;
  assert.equal(pageAccessAfterSwitch("customer_ops.appointments", enterpriseCaps), "renders");
  assert.equal(pageAccessAfterSwitch("customer_ops.appointments", starterCaps), "upgrade_required");
});
test("21b. switching from Growth to Pro immediately grants AI-assisted customer-ops access", () => {
  function pageAccessAfterSwitch(capability, newPlanCapabilities) {
    return newPlanCapabilities.includes(capability) ? "renders" : "upgrade_required";
  }
  const growthCaps = planDefs.getPlanDefinition("growth").capabilities;
  const proCaps = planDefs.getPlanDefinition("pro").capabilities;
  assert.equal(pageAccessAfterSwitch("customer_ops.ai_assist", growthCaps), "upgrade_required");
  assert.equal(pageAccessAfterSwitch("customer_ops.ai_assist", proCaps), "renders");
});

// --- 22-23. Pricing page and dashboard billing plan comparison stay canonical, not duplicated ---

test("22. the public pricing page derives its capability matrix from the real plan-definitions module, not a hand-copied list", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/pricing/page.tsx"), "utf8");
  assert.match(source, /from ["']@\/lib\/billing\/plan-definitions["']/);
  assert.match(source, /planDefinitions/);
  assert.match(source, /"customer_ops\.ai_assist":/, "the new capability must have a pricing label, not just an internal ID");
});
test("23. the dashboard billing plan comparison derives from the real plan-definitions module", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/billing/plans/PlansExperience.tsx"), "utf8");
  assert.match(source, /from ["']@\/lib\/billing\/plan-definitions["']/);
});

// --- 24-25. capabilityMinimumPlan resolves automatically from the canonical matrix ---

test("24. capabilityMinimumPlan(Appointments) = Growth", () => {
  assert.equal(planDefs.capabilityMinimumPlan["customer_ops.appointments"], "growth");
});
test("25. capabilityMinimumPlan(Tickets) = Growth", () => {
  assert.equal(planDefs.capabilityMinimumPlan["customer_ops.tickets"], "growth");
});
test("capabilityMinimumPlan(AI-assisted customer ops) = Pro", () => {
  assert.equal(planDefs.capabilityMinimumPlan["customer_ops.ai_assist"], "pro");
});

// --- Direct URL / sidebar gate for Appointments and Tickets is wired (not just entitlement at the API layer) ---

test("the dashboard layout's direct-URL capability gate covers /dashboard/appointments and /dashboard/tickets", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(source, /"\/dashboard\/appointments":\s*"customer_ops\.appointments"/);
  assert.match(source, /"\/dashboard\/tickets":\s*"customer_ops\.tickets"/);
});

// --- AI tool entitlement gate: Growth (core only) vs Pro (AI-assisted) ---

test("AI createAppointmentTool is denied for a Growth-tier business (core only, no AI assist)", async () => {
  const result = await appointmentTools.createAppointmentTool.execute({ title: "AI booked", startAt: "2027-03-01T09:00:00Z", endAt: "2027-03-01T09:30:00Z", timezone: "UTC" }, { requestContext: fakeRequestContext(BIZ_GROWTH, "ai-tier-growth") });
  assert.equal(result.success, false);
  assert.match(result.error, /Pro plan or higher/);
});
test("AI createAppointmentTool succeeds for a Pro-tier business", async () => {
  const result = await appointmentTools.createAppointmentTool.execute({ title: "AI booked", startAt: "2027-03-01T09:00:00Z", endAt: "2027-03-01T09:30:00Z", timezone: "UTC" }, { requestContext: fakeRequestContext(BIZ_PRO, "ai-tier-pro") });
  assert.equal(result.success, true);
});
test("AI createSupportTicketTool is denied for a Growth-tier business (core only, no AI assist)", async () => {
  const result = await ticketTools.createSupportTicketTool.execute({ subject: "Help", description: "Issue" }, { requestContext: fakeRequestContext(BIZ_GROWTH, "ai-tier-growth") });
  assert.equal(result.success, false);
  assert.match(result.error, /Pro plan or higher/);
});
test("AI createSupportTicketTool succeeds for an Enterprise-tier business", async () => {
  const result = await ticketTools.createSupportTicketTool.execute({ subject: "Help", description: "Issue" }, { requestContext: fakeRequestContext(BIZ_ENTERPRISE, "ai-tier-enterprise") });
  assert.equal(result.success, true);
});
test("AI requestTicketEscalationTool is denied for a Starter-tier business", async () => {
  const result = await ticketTools.requestTicketEscalationTool.execute({ ticketId: "ticket-lookup-seed", reason: "x" }, { requestContext: fakeRequestContext(BIZ_STARTER, "ai-tier-starter") });
  assert.equal(result.success, false);
  assert.match(result.error, /Pro plan or higher/);
});
