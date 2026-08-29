import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = {
  "app/api/ai/receptionist/route.ts": ["PERMISSIONS.RECEPTION_AI", "customer_ops.appointments"],
  "app/api/ai/sales/route.ts": ["PERMISSIONS.SALES_AI", "customer_ops.leads"],
  "app/api/ai/customer-support/route.ts": ["PERMISSIONS.MESSAGING_MANAGE", "customer_ops.tickets"],
};

for (const [file, gates] of Object.entries(routes)) {
  test(`${file} gates agent execution by permission and capability`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, new RegExp(gates[0].replace(".", "\\.")));
    assert.match(source, new RegExp(gates[1].replace(".", "\\.")));
    assert.match(source, /hasCapability/);
    assert.match(source, /hasPermission/);
  });
}

test("AI Customer Support authority remains escalation-only for tickets", async () => {
  const source = await readFile("mastra/tools/ticket-tools.ts", "utf8");
  assert.match(source, /request-ticket-escalation/);
  assert.doesNotMatch(source, /resolve-ticket|close-ticket|reopen-ticket/);
});

// --- Sales AI customer-contact and CRM-mutation authority -----------------
//
// Prior audit finding: the Sales agent had a live sendWhatsAppMessage tool
// that delivered a real WhatsApp message with no approval, no entitlement
// check, and no audit log — while its own system prompt repeatedly claimed
// no such tool existed. This block proves the tool is gone, the only
// customer-contact path is the existing human-approval pipeline, the
// prompt no longer contradicts the agent's actual tools, and every
// autonomous CRM mutation the agent can still make is audit-logged.

let salesAgentSource;
let salesRouteSource;

test.before(async () => {
  salesAgentSource = await readFile("mastra/agents/sales.ts", "utf8");
  salesRouteSource = await readFile("app/api/ai/sales/route.ts", "utf8");
});

test("the unsafe direct-send WhatsApp tool no longer exists", () => {
  assert.equal(existsSync("mastra/tools/send-whatsapp-message.ts"), false);
  assert.doesNotMatch(salesAgentSource, /sendWhatsAppMessage/);
});

test("the unsafe direct-mutation salesExecuteAction tool no longer exists", () => {
  assert.equal(existsSync("mastra/tools/sales-execute-action.ts"), false);
  assert.doesNotMatch(salesAgentSource, /salesExecuteAction/);
});

test("the Sales agent's only customer-contact tool is the approval-queuing one, and it is actually registered", () => {
  assert.match(salesAgentSource, /import \{ salesExternalActionTool \} from "@\/mastra\/tools\/sales-external-action"/);
  assert.match(salesAgentSource, /salesExternalAction:\s*salesExternalActionTool/);
});

test("salesExternalAction never sends — it only ever queues a pending approval", async () => {
  const source = await readFile("mastra/tools/sales-external-action.ts", "utf8");
  assert.match(source, /status:\s*"pending"/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /sendWhatsAppToPhone/);
});

test("the Sales prompt no longer contains the false 'no messaging tool exists' claim", () => {
  assert.doesNotMatch(salesAgentSource, /do NOT provide a tool for actually calling/);
  assert.doesNotMatch(salesAgentSource, /completeFollowUp is not currently available to this agent/);
});

test("the Sales prompt accurately describes the approval-required contact flow", () => {
  assert.match(salesAgentSource, /salesExternalAction tool to request approval/);
  assert.match(salesAgentSource, /MUST NOT claim that the customer was contacted/);
});

test("the Sales route's execution-safety comment matches the actual (approval-only) architecture", () => {
  assert.doesNotMatch(salesRouteSource, /Kuba Sales now has a real WhatsApp sending tool/);
  assert.match(salesRouteSource, /salesExternalAction/);
});

test("approved WhatsApp actions are actually deliverable — execute resolves the customer-service window by phone, not by a nonexistent conversationId", async () => {
  const source = await readFile("app/api/action-approvals/[id]/execute/route.ts", "utf8");
  assert.match(source, /sendWhatsAppToPhone/);
  assert.match(source, /channel === "whatsapp"/);
});

test("approved-action execution is entitlement-gated and audit-logged", async () => {
  const source = await readFile("app/api/action-approvals/[id]/execute/route.ts", "utf8");
  assert.match(source, /business_ops\.approvals/);
  assert.match(source, /createAuditLog/);
});

const auditedSalesTools = [
  ["mastra/tools/create-lead.ts", "ai.sales.create_lead"],
  ["mastra/tools/update-lead.ts", "ai.sales.update_lead"],
  ["mastra/tools/create-follow-up.ts", "ai.sales.create_follow_up"],
  ["mastra/tools/complete-follow-up.ts", "ai.sales.complete_follow_up"],
  ["mastra/tools/create-sales-activity.ts", "ai.sales.create_activity"],
];

for (const [file, action] of auditedSalesTools) {
  test(`${file} logs an audit event for its autonomous mutation and never trusts a client-supplied businessId`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /createAuditLog/);
    assert.match(source, new RegExp(action.replaceAll(".", "\\.")));
    assert.match(source, /requireBusinessId\(requestContext\)/);
    assert.doesNotMatch(source, /businessId:\s*z\./); // no businessId accepted as tool input
  });
}

test("the human-initiated follow-up WhatsApp send route resolves the acting business from session/membership, not a raw first-row lookup, and is permission-gated and audited", async () => {
  const source = await readFile("app/api/follow-ups/[id]/send/route.ts", "utf8");
  assert.match(source, /getCurrentMembership/);
  assert.match(source, /PERMISSIONS\.MESSAGING_MANAGE/);
  assert.match(source, /createAuditLog/);
  assert.doesNotMatch(source, /sendWhatsAppMessageTool/);
});

// --- Duplicate, weaker approval-execution path (found while auditing nav) -
//
// /dashboard/actions and its backing routes /api/actions/{approval,execute}
// operated on the SAME actionApprovals table as the properly-built
// /api/action-approvals/* pipeline, but without the business_ops.approvals
// entitlement check, without any audit logging, and with the identical
// WhatsApp customer-service-window bug (conversationId: "" always failing
// the window check). It was reachable only from itself (no nav entry
// anywhere), so it was removed rather than wired into navigation or
// silently left as a second, less-safe way to execute the same real
// customer communication.
test("the duplicate, unaudited, unentitled approval-execution path no longer exists", () => {
  assert.equal(existsSync("app/dashboard/actions"), false);
  assert.equal(existsSync("app/api/actions/approval"), false);
  assert.equal(existsSync("app/api/actions/execute"), false);
});

test("the canonical action-approvals pipeline remains the only one, and stays entitlement-gated", async () => {
  for (const file of ["app/api/action-approvals/route.ts", "app/api/action-approvals/[id]/route.ts", "app/api/action-approvals/[id]/execute/route.ts"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /business_ops\.approvals/);
  }
});
