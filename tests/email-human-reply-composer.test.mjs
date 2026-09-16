import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (file) => readFile(file, "utf8");

test("Inbox exposes a human Email reply composer only after takeover", async () => {
  const inbox = await source("app/dashboard/inbox/page.tsx");
  assert.match(inbox, /selected\.channel === "email" && selected\.routingStatus === "human_handling"/);
  assert.match(inbox, /placeholder="Reply by email\.\.\."/);
  assert.match(inbox, /disabled=\{!replyDraft\.trim\(\) \|\| replyAction\.status === "sending"\}/);
  assert.match(inbox, /conversationId: selected\.id, content/);
  assert.match(inbox, /replyAction\.status === "sending"/);
  assert.match(inbox, /replies use the customer email and signed thread address/i);
});

test("human Email send route enforces tenant and messaging management access", async () => {
  const route = await source("app/api/messages/send/route.ts");
  assert.match(route, /getBusinessMembership\(session\.user\.id, business\.businessId\)/);
  assert.match(route, /PERMISSIONS\.MESSAGING_MANAGE/);
  assert.match(route, /canAccessConversation\(\s*session\.user\.id,\s*conversationId/);
  assert.match(route, /eq\(integrations\.id, conversation\[0\]\.integrationId\)/);
  assert.match(route, /eq\(integrations\.businessId, business\.businessId\)/);
  assert.match(route, /recipient: channel === "email" \? conversation\[0\]\.customerEmail/);
  assert.match(route, /if \(!sent\.success\)/);
  assert.match(route, /externalMessageId:\s*sent\.externalMessageId/);
  assert.match(route, /senderType: "human"/);
  assert.match(route, /channel === "email" \? null : await kubaSalesAgent\.generate/);
});

test("Email adapter remains the canonical signed-thread sender", async () => {
  const adapter = await source("lib/channels/email.ts");
  assert.match(adapter, /eq\(integrations\.businessId, payload\.businessId\)/);
  assert.match(adapter, /eq\(integrations\.provider, "email"\)/);
  assert.match(adapter, /eq\(integrations\.status, "active"\)/);
  assert.match(adapter, /buildReplyToAddress\(\s*createReplyToken\(\{ businessId: payload\.businessId, conversationId: payload\.conversationId \}\)/s);
  assert.match(adapter, /SuperKuba <\$\{signedReplyAddress\}>/);
  assert.match(adapter, /replyTo/);
  assert.match(adapter, /idempotencyKey:/);
});
