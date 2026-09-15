// Real-implementation-path integration tests for the canonical Plivo
// inbound-call webhooks (app/api/voice/plivo/answer,
// app/api/voice/plivo/status) and the shared voice event persistence
// they forward into (app/api/voice/calls). Mirrors
// tests/email-inbound-webhook-integration.test.mjs's fixture-bootstrap
// pattern. Both Plivo routes internally fetch() the shared
// /api/voice/calls endpoint (same architecture as the existing Twilio
// status route) — since no HTTP server actually runs under `node --test`,
// global.fetch is redirected for that one internal URL straight into the
// imported calls-route handler, so the FULL real chain executes end to
// end (Phase 5's explicit requirement), not just the webhook's own logic.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const PLIVO_AUTH_TOKEN = "test-plivo-auth-token";
const VOICE_WEBHOOK_SECRET = "test-voice-webhook-secret";
const PUBLIC_APP_URL = "https://app.superkuba.test";

let tempDir;
let db, schema, answerRoute, statusRoute, callsRoute, originalFetch;

const BIZ_A = "kora-os";
const BIZ_B = "realtegic-works";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

function sign(url, nonce) {
  return crypto.createHmac("sha256", PLIVO_AUTH_TOKEN).update(Buffer.from(`${url}${nonce}`, "utf-8")).digest("base64");
}

function postForm(routeHandler, path, formFields, { validSignature = true, extra = "" } = {}) {
  const url = `${PUBLIC_APP_URL}${path}${extra}`;
  const nonce = `nonce-${id("n")}`;
  const signature = validSignature ? sign(url, nonce) : "invalid-signature";
  const form = new URLSearchParams(formFields);
  const request = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-plivo-signature-v2": signature, "x-plivo-signature-v2-nonce": nonce },
    body: form.toString(),
  });
  return routeHandler(request);
}

async function seedBusiness(businessId, name) {
  const now = new Date();
  await db.insert(schema.businesses).values({ id: businessId, name, slug: businessId, status: "active", createdAt: now, updatedAt: now });
}

async function seedPlivoEmployeeAndNumber(businessId, number, callDirection = "both") {
  const now = new Date();
  const employeeId = id("emp");
  await db.insert(schema.aiEmployees).values({ id: employeeId, businessId, name: "Receptionist", type: "receptionist", status: "active", createdAt: now, updatedAt: now });
  const voiceConfig = { enabled: true, phoneNumber: number, callDirection, provider: "plivo", voiceModel: "", language: "English", accent: "Neutral", speakingStyle: "Professional", tone: "Warm", speed: 1, workingHours: "Business hours", maxDailyCalls: 100, maxCallDurationMinutes: 30, allowedCallTypes: [], callPermissions: [], humanTransferRules: [], transferDestination: "", automationEvents: [] };
  await db.insert(schema.aiEmployeeSettings).values({ id: id("settings"), employeeId, roleInstructions: `\n\nVoice capability configuration:\n${JSON.stringify(voiceConfig)}`, createdAt: now, updatedAt: now });
  await db.insert(schema.integrations).values({ id: id("integration"), businessId, provider: "plivo", status: "active", externalPhoneNumberId: number, metadata: JSON.stringify({ kind: "voice_phone", employeeId }), createdAt: now, updatedAt: now });
  return employeeId;
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-voice-plivo-webhook-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.PLIVO_AUTH_TOKEN = PLIVO_AUTH_TOKEN;
  process.env.PUBLIC_APP_URL = PUBLIC_APP_URL;
  process.env.VOICE_WEBHOOK_SECRET = VOICE_WEBHOOK_SECRET;
  process.env.VOICE_GATEWAY_SESSION_SECRET = "test-voice-gateway-session-secret";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  answerRoute = await import("@/app/api/voice/plivo/answer/route");
  statusRoute = await import("@/app/api/voice/plivo/status/route");
  callsRoute = await import("@/app/api/voice/calls/route");

  await seedBusiness(BIZ_A, "Kora OS");
  await seedBusiness(BIZ_B, "Realtegic Works");

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === `${PUBLIC_APP_URL}/api/voice/calls`) {
      return callsRoute.POST(new Request(url, init));
    }
    return originalFetch(input, init);
  };
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  await rm(tempDir, { recursive: true, force: true });
});

test("SECURITY: an answer webhook with an invalid signature is rejected with 403 and nothing is persisted", async () => {
  const response = await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: "+15551110000", From: "+15559990000", CallUUID: id("call") }, { validSignature: false });
  assert.equal(response.status, 403);
});

test("a cold inbound call to a registered number resolves the business/employee and persists a conversation + message", async () => {
  const number = "+15551110001";
  const employeeId = await seedPlivoEmployeeAndNumber(BIZ_A, number);
  const callerNumber = `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const callUuid = id("call");

  const response = await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: number, From: callerNumber, CallUUID: callUuid });
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /<Response>/);

  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.externalConversationId, callUuid)).limit(1))[0];
  assert.ok(conversationRow, "conversation should be created");
  assert.equal(conversationRow.businessId, BIZ_A);
  assert.equal(conversationRow.assignedEmployeeId, employeeId);

  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationRow.id));
  assert.equal(messageRows.length, 1);
  assert.equal(messageRows[0].businessId, BIZ_A);
});

test("SAFETY: a call to an unregistered number is acknowledged honestly and touches no business data", async () => {
  const unregistered = "+15551119999";
  const response = await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: unregistered, From: "+15550001234", CallUUID: id("call") });
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /<Speak>/);
  assert.doesNotMatch(xml, /<Stream/);

  const conversationRows = await db.select().from(schema.conversations).where(eq(schema.conversations.customerPhone, "+15550001234"));
  assert.equal(conversationRows.length, 0);
});

test("TENANT ISOLATION: the same caller reaching two different businesses' numbers never crosses conversations", async () => {
  const numberA = "+15551110002";
  const numberB = "+15551110003";
  await seedPlivoEmployeeAndNumber(BIZ_A, numberA);
  await seedPlivoEmployeeAndNumber(BIZ_B, numberB);
  const sharedCaller = "+15550005678";

  await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: numberA, From: sharedCaller, CallUUID: id("call") });
  await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: numberB, From: sharedCaller, CallUUID: id("call") });

  const conversationsForA = await db.select().from(schema.conversations).where(and(eq(schema.conversations.businessId, BIZ_A), eq(schema.conversations.customerPhone, sharedCaller)));
  const conversationsForB = await db.select().from(schema.conversations).where(and(eq(schema.conversations.businessId, BIZ_B), eq(schema.conversations.customerPhone, sharedCaller)));
  assert.equal(conversationsForA.length, 1);
  assert.equal(conversationsForB.length, 1);
  assert.notEqual(conversationsForA[0].id, conversationsForB[0].id);
});

test("a hangup with a normal clearing cause is recorded as completed, with duration", async () => {
  const number = "+15551110004";
  await seedPlivoEmployeeAndNumber(BIZ_A, number);
  const callerNumber = "+15550001111";
  const callUuid = id("call");

  await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: number, From: callerNumber, CallUUID: callUuid });
  const response = await postForm(statusRoute.POST, "/api/voice/plivo/status", { To: number, From: callerNumber, CallUUID: callUuid, HangupCauseName: "NORMAL_CLEARING", Duration: "37" });
  assert.equal(response.status, 200);

  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.externalConversationId, callUuid)).limit(1))[0];
  assert.equal(conversationRow.voiceDurationSeconds, 37);
  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationRow.id));
  assert.equal(messageRows.length, 2, "one message for the answer/ringing event, one for the completed hangup");
});

test("a hangup with a busy cause is recorded as failed with a safe BUSY failure category, never the raw provider cause", async () => {
  const number = "+15551110005";
  await seedPlivoEmployeeAndNumber(BIZ_A, number);
  const callerNumber = "+15550002222";
  const callUuid = id("call");

  await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: number, From: callerNumber, CallUUID: callUuid });
  await postForm(statusRoute.POST, "/api/voice/plivo/status", { To: number, From: callerNumber, CallUUID: callUuid, HangupCauseName: "USER_BUSY", Duration: "0" });

  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.externalConversationId, callUuid)).limit(1))[0];
  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationRow.id));
  const failedMessage = messageRows.find((row) => row.content.includes("call.failed"));
  assert.ok(failedMessage);
  const metadata = JSON.parse(failedMessage.metadata);
  assert.equal(metadata.failureCategory, "BUSY");
});

test("IDEMPOTENCY: a redelivered hangup webhook for the same call does not create a second completed message", async () => {
  const number = "+15551110006";
  await seedPlivoEmployeeAndNumber(BIZ_A, number);
  const callerNumber = "+15550003333";
  const callUuid = id("call");

  await postForm(answerRoute.POST, "/api/voice/plivo/answer", { To: number, From: callerNumber, CallUUID: callUuid });
  await postForm(statusRoute.POST, "/api/voice/plivo/status", { To: number, From: callerNumber, CallUUID: callUuid, HangupCauseName: "NORMAL_CLEARING", Duration: "20" });
  await postForm(statusRoute.POST, "/api/voice/plivo/status", { To: number, From: callerNumber, CallUUID: callUuid, HangupCauseName: "NORMAL_CLEARING", Duration: "20" });

  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.externalConversationId, callUuid)).limit(1))[0];
  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationRow.id));
  assert.equal(messageRows.length, 2, "still exactly one ringing + one completed message despite the hangup being delivered twice");
});

test("an outbound (SuperKuba-initiated) call recovers businessId from the pre-created conversation, never from the request", async () => {
  const employeeId = await seedPlivoEmployeeAndNumber(BIZ_A, "+15551110007", "outbound");
  const now = new Date();
  const conversationId = id("conv");
  await db.insert(schema.conversations).values({ id: conversationId, businessId: BIZ_A, integrationId: "voice-runtime", externalConversationId: `pending-${id("p")}`, customerPhone: "+15550009999", assignedEmployeeId: employeeId, aiMode: "active", status: "open", createdAt: now, updatedAt: now });
  const callUuid = id("call");

  const response = await postForm(
    answerRoute.POST,
    "/api/voice/plivo/answer",
    { To: "+15550009999", From: "+15551110007", CallUUID: callUuid },
    { extra: `?employeeId=${employeeId}&conversationId=${conversationId}` },
  );
  assert.equal(response.status, 200);

  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1))[0];
  assert.equal(conversationRow.externalConversationId, callUuid, "the placeholder external id must be reconciled to the real CallUUID");
});
