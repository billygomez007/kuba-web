// Real-implementation-path tests for lib/voice/gateway-session.ts (the
// signed session-bootstrap token kuba-web mints for the Voice Gateway)
// and the three app/api/internal/voice/* routes that require it.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const INTERNAL_SECRET = "test-voice-gateway-internal-secret";
const SESSION_SECRET = "test-voice-gateway-session-secret";

let db, schema, gatewaySession, sessionContextRoute, callEventsRoute, toolCallRoute;
let tempDir;
const BIZ = "biz-voice-gateway";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedVoiceEmployee(businessId, employeeType = "receptionist") {
  const now = new Date();
  const employeeId = id("emp");
  await db.insert(schema.aiEmployees).values({ id: employeeId, businessId, name: "Test Employee", type: employeeType, status: "active", createdAt: now, updatedAt: now });
  const voiceConfig = { enabled: true, phoneNumber: "", callDirection: "both", provider: "plivo", voiceModel: "alloy", language: "English", accent: "Neutral", speakingStyle: "Professional", tone: "Warm", speed: 1, workingHours: "Business hours", maxDailyCalls: 100, maxCallDurationMinutes: 30, allowedCallTypes: [], callPermissions: [], humanTransferRules: [], transferDestination: "", automationEvents: [] };
  await db.insert(schema.aiEmployeeSettings).values({ id: id("settings"), employeeId, roleInstructions: `Be helpful.\n\nVoice capability configuration:\n${JSON.stringify(voiceConfig)}`, goals: "Help callers.", createdAt: now, updatedAt: now });
  return employeeId;
}

function postInternal(routeHandler, body, { secret = INTERNAL_SECRET } = {}) {
  const request = new Request("https://kuba-web.test/api/internal/voice/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-voice-gateway-internal-secret": secret },
    body: JSON.stringify(body),
  });
  return routeHandler(request);
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-voice-gateway-session-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.VOICE_GATEWAY_INTERNAL_SECRET = INTERNAL_SECRET;
  process.env.VOICE_GATEWAY_SESSION_SECRET = SESSION_SECRET;

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  gatewaySession = await import("@/lib/voice/gateway-session");
  sessionContextRoute = await import("@/app/api/internal/voice/session-context/route");
  callEventsRoute = await import("@/app/api/internal/voice/call-events/route");
  toolCallRoute = await import("@/app/api/internal/voice/tool-call/route");

  const now = new Date();
  await db.insert(schema.businesses).values({ id: BIZ, name: "Gateway Test Biz", slug: BIZ, status: "active", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Token signing/verification ---

test("a genuinely valid token round-trips through createVoiceSessionToken + verifyVoiceSessionToken", () => {
  const token = gatewaySession.createVoiceSessionToken({ sessionId: "call-1", businessId: BIZ, employeeId: "emp-1", provider: "plivo", direction: "inbound" });
  const claims = gatewaySession.verifyVoiceSessionToken(token);
  assert.ok(claims);
  assert.equal(claims.businessId, BIZ);
  assert.equal(claims.employeeId, "emp-1");
  assert.equal(claims.provider, "plivo");
  assert.equal(claims.direction, "inbound");
});

test("SECURITY: an expired token is rejected", () => {
  const token = gatewaySession.createVoiceSessionToken({ sessionId: "call-2", businessId: BIZ, employeeId: "emp-1", provider: "plivo", direction: "inbound", ttlSeconds: -1 });
  assert.equal(gatewaySession.verifyVoiceSessionToken(token), null);
});

test("SECURITY: a tampered businessId is rejected even though the rest of the token is untouched", () => {
  const token = gatewaySession.createVoiceSessionToken({ sessionId: "call-3", businessId: BIZ, employeeId: "emp-1", provider: "plivo", direction: "inbound" });
  const [encoded, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  payload.businessId = "some-other-business";
  const tamperedEncoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const tamperedToken = `${tamperedEncoded}.${signature}`;
  assert.equal(gatewaySession.verifyVoiceSessionToken(tamperedToken), null);
});

test("a malformed token never throws, just fails closed", () => {
  assert.equal(gatewaySession.verifyVoiceSessionToken("not-a-real-token"), null);
  assert.equal(gatewaySession.verifyVoiceSessionToken(""), null);
  assert.equal(gatewaySession.verifyVoiceSessionToken("a.b.c"), null);
});

// --- session-context ---

test("session-context requires the internal secret header", async () => {
  const employeeId = await seedVoiceEmployee(BIZ);
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const response = await postInternal(sessionContextRoute.POST, { token }, { secret: "wrong-secret" });
  assert.equal(response.status, 401);
});

test("session-context rejects an invalid/expired token even with a correct internal secret", async () => {
  const response = await postInternal(sessionContextRoute.POST, { token: "garbage" });
  assert.equal(response.status, 403);
});

test("session-context returns business/employee context derived only from the verified token, never the request body", async () => {
  const employeeId = await seedVoiceEmployee(BIZ, "receptionist");
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const response = await postInternal(sessionContextRoute.POST, { token, businessId: "attacker-supplied-business-id" });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.businessId, BIZ);
  assert.equal(data.employeeId, employeeId);
  assert.equal(data.businessName, "Gateway Test Biz");
  assert.match(data.systemInstructions, /Gateway Test Biz/);
  // The stored VoiceConfig JSON must never leak into the system prompt.
  assert.doesNotMatch(data.systemInstructions, /"provider":"plivo"/);
  assert.ok(Array.isArray(data.tools));
  assert.ok(data.tools.some((tool) => tool.name === "get_business_knowledge"));
});

test("session-context refuses an employee that does not have Voice enabled", async () => {
  const now = new Date();
  const employeeId = id("emp-no-voice");
  await db.insert(schema.aiEmployees).values({ id: employeeId, businessId: BIZ, name: "No Voice", type: "receptionist", status: "active", createdAt: now, updatedAt: now });
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const response = await postInternal(sessionContextRoute.POST, { token });
  assert.equal(response.status, 409);
});

// --- call-events ---

test("call-events persists a conversation/message via the shared persistEvent path", async () => {
  const employeeId = await seedVoiceEmployee(BIZ);
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const providerCallId = id("call-uuid");
  const response = await postInternal(callEventsRoute.POST, { token, event: { type: "call.completed", providerCallId, phoneNumber: "+15550001234", direction: "inbound", durationSeconds: 42 } });
  assert.equal(response.status, 200);
  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.externalConversationId, providerCallId)).limit(1))[0];
  assert.ok(conversationRow);
  assert.equal(conversationRow.voiceDurationSeconds, 42);
});

// --- tool-call ---

test("tool-call requires the internal secret and a valid session token", async () => {
  const response = await postInternal(toolCallRoute.POST, { token: "garbage", toolName: "get_business_knowledge", arguments: {} });
  assert.equal(response.status, 403);
});

test("tool-call refuses a tool name that is not in the allowlist", async () => {
  const employeeId = await seedVoiceEmployee(BIZ);
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const response = await postInternal(toolCallRoute.POST, { token, toolName: "delete_all_customers", arguments: {} });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, false);
});

test("tool-call executes the allowlisted get_business_knowledge tool through the real authority check", async () => {
  const employeeId = await seedVoiceEmployee(BIZ);
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const response = await postInternal(toolCallRoute.POST, { token, toolName: "get_business_knowledge", arguments: {} });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
});

test("SECURITY: an inactive employee's tool call is refused even with a valid, unexpired token", async () => {
  const now = new Date();
  const employeeId = id("emp-inactive");
  await db.insert(schema.aiEmployees).values({ id: employeeId, businessId: BIZ, name: "Inactive", type: "receptionist", status: "inactive", createdAt: now, updatedAt: now });
  const token = gatewaySession.createVoiceSessionToken({ sessionId: id("call"), businessId: BIZ, employeeId, provider: "plivo", direction: "inbound" });
  const response = await postInternal(toolCallRoute.POST, { token, toolName: "get_business_knowledge", arguments: {} });
  assert.equal(response.status, 404);
});
