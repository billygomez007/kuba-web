// Real-implementation-path tests for AI Workforce orchestration: the
// canonical channel-eligibility policy, the AI-to-AI/AI-to-human handoff
// resolution+persistence core, the request-handoff Mastra tool, and the
// getKubaAgent registry bug fix (customer-support/general-manager
// conversations were silently handled by the Receptionist agent before this
// pass). Exercises real production code against a disposable local SQLite
// database — never Turso/superkuba-staging.
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
let channelPolicy;
let handoff;
let registry;
let requestHandoffTool;

const BIZ_A = "orch-biz-a";
const BIZ_B = "orch-biz-b";

function fakeRequestContext(values) {
  return { get: (key) => values[key] };
}

async function insertConversation({ id, businessId, integrationId = "integration-1" }) {
  const now = new Date();
  await db.insert(schema.conversations).values({
    id,
    businessId,
    customerId: null,
    integrationId,
    externalConversationId: id,
    customerName: "Test Customer",
    customerPhone: null,
    customerEmail: null,
    assignedEmployeeId: null,
    aiMode: "active",
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-orchestration-"));
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
  channelPolicy = await import("@/lib/communications/channel-policy");
  handoff = await import("@/lib/communications/handoff");
  registry = await import("@/lib/communications/ai-agent-registry");
  ({ requestHandoffTool } = await import("@/mastra/tools/request-handoff"));

  const now = new Date();
  for (const id of [BIZ_A, BIZ_B]) {
    await db.insert(schema.businesses).values({ id, name: `Orchestration Business ${id}`, slug: `orch-${id}`, plan: "pro", status: "active", createdAt: now, updatedAt: now });
    await db.insert(schema.subscriptions).values({ id: crypto.randomUUID(), businessId: id, provider: "stripe", providerCustomerId: `cus_${id}`, providerSubscriptionId: `sub_${id}`, providerEventId: `evt_${id}`, plan: "pro", status: "active", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now });
  }

  // Business A: a full customer-facing roster, Operator autonomy so
  // requestHandoff's underlying authority check allows it directly.
  for (const type of ["receptionist", "sales", "customer-support", "appointment"]) {
    await db.insert(schema.aiEmployees).values({ id: `${type}-a`, businessId: BIZ_A, name: `${type} A`, type, supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });
  }
  // An Assistant-autonomy Receptionist, to prove requestHandoff still
  // respects the approval floor.
  await db.insert(schema.aiEmployees).values({ id: "receptionist-a-assistant", businessId: BIZ_A, name: "Receptionist A Assistant", type: "receptionist", supervisionMode: "assistant", status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: BIZ_A, employeeId: "receptionist-a-assistant", autonomyLevel: "assistant", policy: JSON.stringify(authority.defaultPolicyForAutonomy("assistant")), createdAt: now, updatedAt: now });

  // Business B: only a Receptionist — no Sales/Support/Appointment — to
  // exercise "no eligible destination" fallback.
  await db.insert(schema.aiEmployees).values({ id: "receptionist-b", businessId: BIZ_B, name: "Receptionist B", type: "receptionist", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });

  // A Custom employee for business A with no grants yet.
  await db.insert(schema.aiEmployees).values({ id: "custom-a", businessId: BIZ_A, name: "Custom A", type: "custom", supervisionMode: "operator", status: "active", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- 1. Canonical channel-eligibility policy ---

test("channel policy: receptionist/sales/customer-support/appointment are eligible on every real customer channel", () => {
  for (const type of ["receptionist", "sales", "customer-support", "appointment"]) {
    for (const channel of ["website_chat", "whatsapp", "email", "voice"]) {
      assert.equal(channelPolicy.isEmployeeChannelEligible({ id: "x", type }, channel), true, `${type} on ${channel}`);
    }
  }
});

test("channel policy: internal-only types (marketing, outreach, general-manager, accountant, finance, hr, operations, custom) are eligible on NO real customer channel by default", () => {
  for (const type of ["marketing", "outreach", "general-manager", "accountant", "finance", "hr", "operations", "custom"]) {
    for (const channel of ["website_chat", "whatsapp", "email", "voice"]) {
      assert.equal(channelPolicy.isEmployeeChannelEligible({ id: "x", type }, channel), false, `${type} on ${channel}`);
    }
  }
});

test("channel policy: every type is eligible on the internal dashboard pseudo-channel", () => {
  for (const type of ["receptionist", "finance", "custom", "some-unknown-type"]) {
    assert.equal(channelPolicy.isEmployeeChannelEligible({ id: "x", type }, "dashboard"), true, type);
  }
});

test("channel policy: a genuinely unmodeled type fails closed on a real channel", () => {
  assert.equal(channelPolicy.isEmployeeChannelEligible({ id: "x", type: "some-unknown-type" }, "website_chat"), false);
});

// --- 2. Custom employee explicit channel grants ---

test("Custom employee has no channel eligibility before any grant", async () => {
  const eligible = await channelPolicy.isEmployeeEligibleForChannel(BIZ_A, { id: "custom-a", type: "custom" }, "website_chat");
  assert.equal(eligible, false);
});

test("Custom employee becomes channel-eligible only after a real, scoped grant row exists", async () => {
  const now = new Date();
  await db.insert(schema.aiEmployeeScopes).values({
    id: crypto.randomUUID(),
    businessId: BIZ_A,
    aiEmployeeId: "custom-a",
    scope: channelPolicy.customChannelScope("website_chat"),
    effect: "allow",
    status: "active",
    grantedByUserId: "user-owner",
    createdAt: now,
    updatedAt: now,
  });
  const eligible = await channelPolicy.isEmployeeEligibleForChannel(BIZ_A, { id: "custom-a", type: "custom" }, "website_chat");
  assert.equal(eligible, true);
  const stillIneligibleForWhatsapp = await channelPolicy.isEmployeeEligibleForChannel(BIZ_A, { id: "custom-a", type: "custom" }, "whatsapp");
  assert.equal(stillIneligibleForWhatsapp, false, "a grant for one channel must not silently grant another");
});

test("TENANT ISOLATION: business B's Custom employee (if it existed) would never see business A's channel grant", async () => {
  const granted = await channelPolicy.isCustomEmployeeChannelGranted(BIZ_B, "custom-a", "website_chat");
  assert.equal(granted, false, "the grant row is scoped to BIZ_A and must never satisfy a BIZ_B lookup even for the same employee id");
});

// --- 3. getKubaAgent registry bug fix ---

test("REGRESSION: getKubaAgent resolves customer-support and general-manager to their OWN agents, not silently to Receptionist (the pre-fix bug)", async () => {
  const { kubaReceptionistAgent } = await import("@/mastra/agents/receptionist");
  const { kubaCustomerSupportAgent } = await import("@/mastra/agents/customer-support");
  const { kubaGeneralManagerAgent } = await import("@/mastra/agents/general-manager");

  assert.equal(registry.getKubaAgent("customer-support"), kubaCustomerSupportAgent);
  assert.notEqual(registry.getKubaAgent("customer-support"), kubaReceptionistAgent);
  assert.equal(registry.getKubaAgent("general-manager"), kubaGeneralManagerAgent);
  assert.notEqual(registry.getKubaAgent("general-manager"), kubaReceptionistAgent);
});

test("getKubaAgent resolves every standard type to a real agent with a generate function, and falls back to Receptionist for custom/unknown", async () => {
  const { kubaReceptionistAgent } = await import("@/mastra/agents/receptionist");
  for (const type of ["receptionist", "sales", "customer-support", "general-manager", "outreach", "marketing", "appointment", "accountant", "finance", "hr", "operations"]) {
    const agent = registry.getKubaAgent(type);
    assert.equal(typeof agent.generate, "function", type);
  }
  assert.equal(registry.getKubaAgent("custom"), kubaReceptionistAgent);
  assert.equal(registry.getKubaAgent("some-unknown-type"), kubaReceptionistAgent);
});

// --- 4. resolveEmployeeForHandoff / resolveEmployeeForDepartment ---

test("resolveEmployeeForHandoff resolves sales/support/appointment/receptionist to the real active employee for business A", async () => {
  for (const [intent, id] of [["sales", "sales-a"], ["support", "customer-support-a"], ["appointment", "appointment-a"], ["receptionist", "receptionist-a"]]) {
    const resolution = await handoff.resolveEmployeeForHandoff({ businessId: BIZ_A, intent, channel: "website_chat" });
    assert.equal(resolution.ok, true, intent);
    assert.equal(resolution.employee.id, id, intent);
  }
});

test("resolveEmployeeForHandoff fails honestly when no eligible employee exists for the intent (business B has no Sales)", async () => {
  const resolution = await handoff.resolveEmployeeForHandoff({ businessId: BIZ_B, intent: "sales", channel: "website_chat" });
  assert.equal(resolution.ok, false);
  assert.match(resolution.reason, /no active sales employee/i);
});

test("resolveEmployeeForDepartment maps finance/marketing (customer-facing signals) to Support/Sales, never to the internal Finance/Marketing employee", async () => {
  const financeResolution = await handoff.resolveEmployeeForDepartment({ businessId: BIZ_A, department: "finance", channel: "website_chat" });
  assert.equal(financeResolution.ok, true);
  assert.equal(financeResolution.employee.type, "customer-support");

  const marketingResolution = await handoff.resolveEmployeeForDepartment({ businessId: BIZ_A, department: "marketing", channel: "website_chat" });
  assert.equal(marketingResolution.ok, true);
  assert.equal(marketingResolution.employee.type, "sales");
});

// --- 5. performAiHandoff: persistence + tenant isolation + audit ---

test("performAiHandoff reassigns a real conversation's routing and legacy assignedEmployeeId, and records a completed handoff row", async () => {
  const conversationId = "conv-handoff-1";
  await insertConversation({ id: conversationId, businessId: BIZ_A });

  const result = await handoff.performAiHandoff({
    businessId: BIZ_A,
    conversationId,
    fromEmployeeId: "receptionist-a",
    intent: "sales",
    channel: "website_chat",
    reason: "Customer wants to buy.",
  });

  assert.equal(result.success, true);
  assert.equal(result.employee.id, "sales-a");

  const routingRows = await db.select().from(schema.conversationRouting).where(eq(schema.conversationRouting.conversationId, conversationId));
  assert.equal(routingRows[0].aiEmployeeId, "sales-a");
  assert.equal(routingRows[0].assignmentType, "ai");
  assert.equal(routingRows[0].status, "ai_handling");

  const conversationRows = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  assert.equal(conversationRows[0].assignedEmployeeId, "sales-a");
  assert.equal(conversationRows[0].aiMode, "active");

  const handoffRows = await db.select().from(schema.handoffs).where(eq(schema.handoffs.conversationId, conversationId));
  assert.equal(handoffRows.length, 1);
  assert.equal(handoffRows[0].status, "completed");
  assert.equal(handoffRows[0].fromEmployeeId, "receptionist-a");
  assert.equal(handoffRows[0].toUserId, null, "AI-to-AI handoffs never assign a specific human");
});

test("performAiHandoff refuses a conversation belonging to a different business, even with a valid intent", async () => {
  const conversationId = "conv-handoff-cross-tenant";
  await insertConversation({ id: conversationId, businessId: BIZ_B });

  const result = await handoff.performAiHandoff({
    businessId: BIZ_A,
    conversationId,
    fromEmployeeId: "receptionist-a",
    intent: "sales",
    channel: "website_chat",
    reason: "Attempted cross-tenant handoff.",
  });

  assert.equal(result.success, false);
  assert.match(result.error, /not found for this business/i);
});

// --- 6. performHumanEscalation: queued for a human, never a specific person ---

test("performHumanEscalation sets waiting_for_human routing state and a pending handoff row with no assigned user", async () => {
  const conversationId = "conv-human-escalation-1";
  await insertConversation({ id: conversationId, businessId: BIZ_A });

  const result = await handoff.performHumanEscalation({
    businessId: BIZ_A,
    conversationId,
    fromEmployeeId: "customer-support-a",
    reason: "Customer is upset and asked for a person.",
  });

  assert.equal(result.success, true);

  const routingRows = await db.select().from(schema.conversationRouting).where(eq(schema.conversationRouting.conversationId, conversationId));
  assert.equal(routingRows[0].status, "waiting_for_human");
  assert.equal(routingRows[0].assignedUserId, null, "the model never chooses a specific human");
  assert.equal(routingRows[0].aiEmployeeId, null);

  const conversationRows = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  assert.equal(conversationRows[0].aiMode, "paused");

  const handoffRows = await db.select().from(schema.handoffs).where(eq(schema.handoffs.conversationId, conversationId));
  assert.equal(handoffRows[0].status, "pending");
  assert.equal(handoffRows[0].toUserId, null);
});

// --- 7. requestHandoffTool: authority + routing safety ---

test("requestHandoffTool executes an AI-to-AI handoff for an Operator-autonomy employee", async () => {
  const conversationId = "conv-tool-handoff-1";
  await insertConversation({ id: conversationId, businessId: BIZ_A });

  const result = await requestHandoffTool.execute(
    { intent: "appointment", reason: "Customer wants to book a demo." },
    { requestContext: fakeRequestContext({ businessId: BIZ_A, employeeId: "receptionist-a", conversationId, channel: "website_chat" }) },
  );

  assert.equal(result.success, true);
  assert.equal(result.employee.id, "appointment-a");
});

test("requestHandoffTool requires approval for an Assistant-autonomy employee — a handoff never bypasses the approval floor", async () => {
  const conversationId = "conv-tool-handoff-2";
  await insertConversation({ id: conversationId, businessId: BIZ_A });

  const result = await requestHandoffTool.execute(
    { intent: "sales", reason: "Customer wants to buy." },
    { requestContext: fakeRequestContext({ businessId: BIZ_A, employeeId: "receptionist-a-assistant", conversationId, channel: "website_chat" }) },
  );

  assert.equal(result.status, "approval_required");
  assert.ok(result.approvalId);
});

test("requestHandoffTool fails gracefully with no trackable conversation, instead of throwing (dashboard/test-console sessions have no conversationId)", async () => {
  const result = await requestHandoffTool.execute(
    { intent: "sales", reason: "Testing from the dashboard console." },
    { requestContext: fakeRequestContext({ businessId: BIZ_A, employeeId: "receptionist-a", channel: "dashboard" }) },
  );
  assert.equal(result.success, false);
  assert.match(result.error, /no trackable customer conversation/i);
});

test("requestHandoffTool escalates to human when the destination is unavailable and the model asks for it explicitly", async () => {
  const conversationId = "conv-tool-handoff-human";
  await insertConversation({ id: conversationId, businessId: BIZ_B });

  const result = await requestHandoffTool.execute(
    { intent: "human", reason: "No AI employee can resolve this." },
    { requestContext: fakeRequestContext({ businessId: BIZ_B, employeeId: "receptionist-b", conversationId, channel: "website_chat" }) },
  );

  assert.equal(result.success, true);
  const routingRows = await db.select().from(schema.conversationRouting).where(eq(schema.conversationRouting.conversationId, conversationId));
  assert.equal(routingRows[0].status, "waiting_for_human");
});

test("REGRESSION: requestHandoffTool's own Zod input schema never accepts businessId, employeeId, or conversationId from the model — only intent and reason", async () => {
  const source = await readFile(path.join(REPO_ROOT, "mastra/tools/request-handoff.ts"), "utf8");
  const schemaBlock = source.slice(source.indexOf("const requestHandoffInput"), source.indexOf("});", source.indexOf("const requestHandoffInput")));
  assert.doesNotMatch(schemaBlock, /businessId/i);
  assert.doesNotMatch(schemaBlock, /employeeId/i);
  assert.doesNotMatch(schemaBlock, /conversationId/i);
  assert.match(source, /requireBusinessId\(requestContext\)/);
  assert.match(source, /requireEmployeeId\(requestContext\)/);
  assert.match(source, /readConversationId\(requestContext\)/);
});

// --- 8. Agents actually carry the handoff tool ---

for (const [file, name] of [
  ["mastra/agents/receptionist.ts", "Receptionist"],
  ["mastra/agents/sales.ts", "Sales"],
  ["mastra/agents/customer-support.ts", "Customer Support"],
  ["mastra/agents/appointment.ts", "Appointment"],
]) {
  test(`REGRESSION: ${name} agent registers requestHandoffTool`, async () => {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /requestHandoffTool/);
  });
}

// --- 9. Channel adapters use the direct-type fallback and pass trusted context ---

for (const file of ["app/api/integrations/website-chat/route.ts", "app/api/integrations/whatsapp/webhook/route.ts"]) {
  test(`REGRESSION: ${file} uses resolveEmployeeForDepartment as a direct-type fallback and passes conversationId + channel through the trusted RequestContext`, async () => {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /resolveEmployeeForDepartment/);
    assert.match(source, /\["conversationId",\s*conversation/);
    assert.match(source, /\["channel",\s*"(website_chat|whatsapp)"\]/);
  });
}
