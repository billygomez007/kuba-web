// Static policy checks for the Meta WhatsApp Cloud API webhook route.
//
// Matches the style of tests/ai-authority-policy.test.mjs: these assert
// invariants about the route's source without executing it, because
// app/api/integrations/whatsapp/webhook/route.ts imports the full Mastra AI
// agent chain (mastra/agents/receptionist.ts etc.) — importing/invoking it
// in a test would require live OpenAI credentials and make real network
// calls. Real, DB-backed behavioral coverage of the extracted pure/DB
// helpers lives in tests/whatsapp-integration.test.mjs instead.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WEBHOOK_ROUTE = "app/api/integrations/whatsapp/webhook/route.ts";
const INTEGRATIONS_LIST_ROUTE = "app/api/integrations/route.ts";
const CONNECT_ROUTE = "app/api/integrations/whatsapp/route.ts";
const CHANNEL_LIB = "lib/channels/whatsapp.ts";
const FOLLOW_UP_SEND_ROUTE = "app/api/follow-ups/[id]/send/route.ts";

let webhookSource;

test.before(async () => {
  webhookSource = await readFile(WEBHOOK_ROUTE, "utf8");
});

test("GET verification compares hub.verify_token with a timing-safe comparison, not ===", () => {
  assert.match(webhookSource, /hub\.mode/);
  assert.match(webhookSource, /hub\.verify_token/);
  assert.match(webhookSource, /hub\.challenge/);
  assert.match(webhookSource, /safeCompareSecret\(\s*token/);
  assert.doesNotMatch(webhookSource, /token === VERIFY_TOKEN/);
});

test("POST reads the raw body before parsing JSON, and verifies the signature before using parsed content", () => {
  const rawBodyIndex = webhookSource.indexOf("request.text()");
  const verifyCallIndex = webhookSource.indexOf("verifyMetaSignature(rawBody");
  const jsonParseIndex = webhookSource.indexOf("JSON.parse(rawBody)");

  assert.ok(rawBodyIndex > -1, "must read the raw request body");
  assert.ok(verifyCallIndex > -1, "must call verifyMetaSignature");
  assert.ok(jsonParseIndex > -1, "must parse the raw body as JSON");

  assert.ok(rawBodyIndex < verifyCallIndex, "raw body must be read before signature verification");
  assert.ok(verifyCallIndex < jsonParseIndex, "signature must be verified before the body is parsed/used");
});

test("an invalid signature is rejected (403) before any parsed payload is trusted", () => {
  const verifyIndex = webhookSource.indexOf("verifyMetaSignature(rawBody");
  const forbiddenIndex = webhookSource.indexOf('{ error: "Forbidden" }');
  assert.ok(verifyIndex > -1 && forbiddenIndex > -1);
  assert.ok(verifyIndex < forbiddenIndex);
});

test("the webhook never trusts a businessId from the request payload", () => {
  assert.doesNotMatch(webhookSource, /body\.businessId/);
  assert.doesNotMatch(webhookSource, /value\.businessId/);
  assert.doesNotMatch(webhookSource, /incomingMessage\.businessId/);
});

test("tenant resolution is delegated to the shared phone_number_id resolver, not an inline trust of env/payload", () => {
  assert.match(webhookSource, /resolveWhatsAppIntegrationByPhoneNumberId\(/);
  assert.match(webhookSource, /Never trust a business ID supplied by the/);
});

test("an unregistered phone number and an inactive business both fail closed", () => {
  assert.match(webhookSource, /WhatsApp number is not registered with Kuba/);
  assert.match(webhookSource, /Kuba business is inactive/);
});

test("duplicate webhook delivery is detected via the shared idempotency lookup before any message is inserted", () => {
  const dedupIndex = webhookSource.indexOf("findWhatsAppMessageByExternalId(");
  const insertIndex = webhookSource.indexOf("db.insert(messages).values({\n      id: crypto.randomUUID(),\n      businessId: businessId,\n      conversationId: conversation.id,\n      integrationId: integration.id,\n      externalMessageId,");
  assert.ok(dedupIndex > -1, "must check for an existing message by external id");
  assert.ok(insertIndex > -1, "must insert the inbound message");
  assert.ok(dedupIndex < insertIndex, "dedup check must happen before the inbound message is stored");
});

test("an AI reply is only generated/sent when the routing decision assigns the conversation to AI (human takeover gate)", () => {
  const gateIndex = webhookSource.indexOf('routingDecision.assignmentType !== "ai"');
  const generateIndex = webhookSource.indexOf("selectedAgent.generate(businessContext");
  assert.ok(gateIndex > -1, "must gate on routingDecision.assignmentType");
  assert.ok(generateIndex > -1, "must generate an AI reply somewhere");
  assert.ok(gateIndex < generateIndex, "the human-takeover gate must run before the AI generates a reply");
});

test("unsupported/non-text message types are stored for the Unified Inbox but never fed to the AI as if they were text", () => {
  assert.match(webhookSource, /canGenerateAiReply/);
  assert.match(webhookSource, /Viewing this content type is not yet supported/);
});

test("a signature-verified webhook records a truthful lastWebhookAt connection-health signal", () => {
  const healthIndex = webhookSource.indexOf("lastWebhookAt: new Date()");
  const statusHandlingIndex = webhookSource.indexOf("Message status callbacks");
  assert.ok(healthIndex > -1, "must record lastWebhookAt");
  assert.ok(healthIndex < statusHandlingIndex, "health signal must be recorded before branching on event type");
});

test("Meta status callbacks (sent/delivered/read/failed) update stored message status instead of being silently dropped", () => {
  assert.match(webhookSource, /value\.statuses/);
  assert.match(webhookSource, /statusUpdatedAt/);
});

test("outbound replies use per-tenant resolved credentials, never a hardcoded global Authorization header", () => {
  assert.match(webhookSource, /getWhatsAppCredentialsForIntegration\(integration\)/);
  assert.match(webhookSource, /sendWhatsAppText\(credentials/);
  assert.doesNotMatch(webhookSource, /Authorization: `Bearer \$\{ACCESS_TOKEN\}`/);
});

test("GET /api/integrations never selects or returns the encrypted WhatsApp credential column", async () => {
  const source = await readFile(INTEGRATIONS_LIST_ROUTE, "utf8");
  assert.doesNotMatch(source, /credentialsEncrypted/);
});

test("the human-triggered follow-up WhatsApp send never reads Meta secrets directly — it delegates to the tenant-scoped sender", async () => {
  const source = await readFile(FOLLOW_UP_SEND_ROUTE, "utf8");
  assert.doesNotMatch(source, /WHATSAPP_ACCESS_TOKEN/);
  assert.doesNotMatch(source, /Authorization:/);
  assert.match(source, /sendWhatsAppToPhone/);
});

test("no Mastra AI tool sends a WhatsApp message directly — the Sales agent can only request approval", () => {
  assert.equal(existsSync("mastra/tools/send-whatsapp-message.ts"), false);
});

test("connecting a WhatsApp number rejects a phone_number_id already claimed by a different business", async () => {
  const source = await readFile(CONNECT_ROUTE, "utf8");
  assert.match(source, /claimedByAnotherBusiness/);
  assert.match(source, /ne\(integrations\.businessId, membership\.businessId\)/);
  assert.match(source, /already connected to another Kuba business/);
});

test("the old duplicate v21.0 WhatsApp send helper was removed, not left as dead/inconsistent code", () => {
  assert.equal(existsSync("lib/channels/whatsapp-send.ts"), false);
});

test("the channel adapter and Graph API sender live in one canonical module, not duplicated per caller", async () => {
  const source = await readFile(CHANNEL_LIB, "utf8");
  assert.match(source, /export const whatsappAdapter/);
  assert.match(source, /export async function sendWhatsAppText/);
});
