// Real-implementation-path tests for the Meta WhatsApp Cloud API integration.
//
// Mirrors tests/customer-operations-integration.test.mjs: imports the ACTUAL
// production module (lib/channels/whatsapp.ts) via the alias-resolving Node
// loader, and exercises it against a real, disposable local SQLite database
// built from the repository's own schema (scripts/bootstrap-clean-database.mjs).
//
// Deliberately does not import the webhook route itself (app/api/integrations/
// whatsapp/webhook/route.ts) — that module also pulls in the full Mastra AI
// agent chain, which this suite must not exercise (no OpenAI calls, no
// network). Route-level control-flow (signature-before-parse ordering, the
// human-takeover AI-reply gate, secret-exposure avoidance, etc.) is instead
// covered by tests/whatsapp-webhook-policy.test.mjs via static source checks.
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
let db, schema, encryption, whatsapp;

const BIZ_GHANA = "wa-ghana";
const BIZ_LABS = "wa-labs";

async function seed() {
  const now = new Date();

  await db.insert(schema.businesses).values([
    { id: BIZ_GHANA, name: "Ghana Business", slug: "wa-ghana", status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_LABS, name: "Labs Business", slug: "wa-labs", status: "active", createdAt: now, updatedAt: now },
  ]);

  await db.insert(schema.integrations).values([
    {
      id: "int-ghana",
      businessId: BIZ_GHANA,
      provider: "whatsapp",
      status: "active",
      externalPhoneNumberId: "phone-ghana",
      credentialsEncrypted: encryption.encrypt("token-ghana"),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "int-labs",
      businessId: BIZ_LABS,
      provider: "whatsapp",
      status: "active",
      externalPhoneNumberId: "phone-labs",
      credentialsEncrypted: encryption.encrypt("token-labs"),
      createdAt: now,
      updatedAt: now,
    },
    // A disconnected integration must never be usable for sending.
    {
      id: "int-disconnected",
      businessId: BIZ_LABS,
      provider: "whatsapp",
      status: "disconnected",
      externalPhoneNumberId: "phone-disconnected",
      credentialsEncrypted: encryption.encrypt("token-disconnected"),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.conversations).values({
    id: "conv-ghana-1",
    businessId: BIZ_GHANA,
    integrationId: "int-ghana",
    externalConversationId: "233200000000",
    customerPhone: "233200000000",
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.messages).values({
    id: "msg-ghana-inbound-1",
    businessId: BIZ_GHANA,
    conversationId: "conv-ghana-1",
    integrationId: "int-ghana",
    externalMessageId: "wamid.existing",
    direction: "inbound",
    senderType: "customer",
    senderId: "233200000000",
    content: "hello",
    messageType: "text",
    createdAt: now,
  });
}

test.before(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-whatsapp-suite";

  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-whatsapp-"));
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
  encryption = await import("@/lib/encryption");
  whatsapp = await import("@/lib/channels/whatsapp");

  await seed();
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Tenant resolution by phone_number_id (never trust businessId) ---

test("phone_number_id resolves the correct business (Ghana)", async () => {
  const resolved = await whatsapp.resolveWhatsAppIntegrationByPhoneNumberId("phone-ghana");
  assert.equal(resolved.business.id, BIZ_GHANA);
  assert.equal(resolved.integration.id, "int-ghana");
});

test("phone_number_id resolves the correct business (Labs)", async () => {
  const resolved = await whatsapp.resolveWhatsAppIntegrationByPhoneNumberId("phone-labs");
  assert.equal(resolved.business.id, BIZ_LABS);
});

test("an unregistered phone_number_id fails safely (no business resolved)", async () => {
  const resolved = await whatsapp.resolveWhatsAppIntegrationByPhoneNumberId("phone-unknown-999");
  assert.equal(resolved, null);
});

test("a disconnected integration's phone number does not resolve", async () => {
  const resolved = await whatsapp.resolveWhatsAppIntegrationByPhoneNumberId("phone-disconnected");
  assert.equal(resolved, null);
});

// --- Foreign-business isolation ---

test("Ghana's businessId never resolves Labs's integration, and vice versa", async () => {
  const ghana = await whatsapp.resolveWhatsAppIntegrationByBusinessId(BIZ_GHANA);
  const labs = await whatsapp.resolveWhatsAppIntegrationByBusinessId(BIZ_LABS);
  assert.equal(ghana.id, "int-ghana");
  assert.equal(labs.id, "int-labs");
  assert.notEqual(ghana.id, labs.id);
});

test("a disconnected integration cannot be resolved for outbound sending", async () => {
  // BIZ_LABS has both an active ("int-labs") and a disconnected integration;
  // resolution must always prefer/only return the active one, never fall
  // back to a disconnected connection.
  const resolved = await whatsapp.resolveWhatsAppIntegrationByBusinessId(BIZ_LABS);
  assert.equal(resolved.status, "active");
  assert.notEqual(resolved.id, "int-disconnected");
});

// --- Per-tenant credential isolation (the core multi-tenant fix) ---

test("each business's own encrypted access token is decrypted for it, not a shared/global one", async () => {
  const ghanaIntegration = await whatsapp.resolveWhatsAppIntegrationByBusinessId(BIZ_GHANA);
  const labsIntegration = await whatsapp.resolveWhatsAppIntegrationByBusinessId(BIZ_LABS);

  const ghanaCreds = whatsapp.getWhatsAppCredentialsForIntegration(ghanaIntegration);
  const labsCreds = whatsapp.getWhatsAppCredentialsForIntegration(labsIntegration);

  assert.equal(ghanaCreds.accessToken, "token-ghana");
  assert.equal(labsCreds.accessToken, "token-labs");
  assert.notEqual(ghanaCreds.accessToken, labsCreds.accessToken);

  assert.equal(ghanaCreds.phoneNumberId, "phone-ghana");
  assert.equal(labsCreds.phoneNumberId, "phone-labs");
});

test("credential resolution fails safely (null) when no phone number is configured", () => {
  const creds = whatsapp.getWhatsAppCredentialsForIntegration({
    id: "int-broken",
    businessId: BIZ_GHANA,
    externalPhoneNumberId: null,
    credentialsEncrypted: null,
  });
  const originalEnv = process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  assert.equal(creds, null);
  if (originalEnv) process.env.WHATSAPP_PHONE_NUMBER_ID = originalEnv;
});

// --- Idempotency (Meta webhook retries must not duplicate messages) ---

test("an existing (integrationId, externalMessageId) pair is found for dedup", async () => {
  const found = await whatsapp.findWhatsAppMessageByExternalId("int-ghana", "wamid.existing");
  assert.notEqual(found, null);
});

test("idempotency is scoped per-integration: the same externalMessageId under a different integration is not a match", async () => {
  const found = await whatsapp.findWhatsAppMessageByExternalId("int-labs", "wamid.existing");
  assert.equal(found, null);
});

test("an unseen externalMessageId is not treated as a duplicate", async () => {
  const found = await whatsapp.findWhatsAppMessageByExternalId("int-ghana", "wamid.never-seen");
  assert.equal(found, null);
});

// --- Meta webhook signature verification (X-Hub-Signature-256) ---

test("a correctly signed payload is accepted", async () => {
  const crypto = await import("node:crypto");
  const rawBody = JSON.stringify({ hello: "world" });
  const appSecret = "test-app-secret";
  const signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  assert.equal(whatsapp.verifyMetaSignature(rawBody, signature, appSecret), true);
});

test("an invalid signature is rejected", () => {
  assert.equal(whatsapp.verifyMetaSignature("{}", "sha256=deadbeef", "test-app-secret"), false);
});

test("a missing signature header is rejected", () => {
  assert.equal(whatsapp.verifyMetaSignature("{}", null, "test-app-secret"), false);
});

test("a missing app secret is rejected (fails closed, never treats unset config as valid)", () => {
  assert.equal(whatsapp.verifyMetaSignature("{}", "sha256=anything", undefined), false);
});

test("signature comparison rejects a signature for different body content", async () => {
  const crypto = await import("node:crypto");
  const appSecret = "test-app-secret";
  const signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(JSON.stringify({ a: 1 })).digest("hex");
  assert.equal(whatsapp.verifyMetaSignature(JSON.stringify({ a: 2 }), signature, appSecret), false);
});

// --- 24-hour customer service window ---

test("a message received seconds ago is within the customer service window", () => {
  const now = new Date();
  const lastInbound = new Date(now.getTime() - 60 * 1000);
  assert.equal(whatsapp.isWithinCustomerServiceWindow(lastInbound, now), true);
});

test("a message received 25 hours ago is outside the customer service window", () => {
  const now = new Date();
  const lastInbound = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  assert.equal(whatsapp.isWithinCustomerServiceWindow(lastInbound, now), false);
});

test("no prior inbound message at all means the window is not open (a template would be required)", () => {
  assert.equal(whatsapp.isWithinCustomerServiceWindow(null), false);
});

// --- Outbound send fails safely when a business isn't connected ---

test("sendWhatsAppToPhone fails safely for a business with no WhatsApp integration at all", async () => {
  const result = await whatsapp.sendWhatsAppToPhone({
    businessId: "business-never-connected",
    phone: "233200000001",
    message: "hi",
  });
  assert.equal(result.success, false);
  assert.equal(result.error, "not_connected");
});

test("the channel adapter fails safely (never throws) for a conversation outside the service window", async () => {
  // conv-ghana-1's only inbound message is seeded at test start (well within
  // 24h of "now" in this fast test run), so exercise the negative case
  // directly against a conversation with no inbound history at all.
  await db.insert(schema.conversations).values({
    id: "conv-ghana-no-inbound",
    businessId: BIZ_GHANA,
    integrationId: "int-ghana",
    externalConversationId: "233200000099",
    customerPhone: "233200000099",
    status: "open",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const result = await whatsapp.whatsappAdapter.send({
    businessId: BIZ_GHANA,
    conversationId: "conv-ghana-no-inbound",
    recipient: "233200000099",
    message: "proactive outreach",
  });

  assert.equal(result.success, false);
});
