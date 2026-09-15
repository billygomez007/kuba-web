// Real-implementation-path tests for lib/voice/tenant.ts — the voice
// equivalent of lib/channels/whatsapp.ts's
// resolveWhatsAppIntegrationByPhoneNumberId. Mirrors the alias-loader +
// real-sqlite fixture pattern used by the email/outreach integration
// suites.
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

let db, schema, tenant;
let tempDir;

const BIZ_A = "kora-os";
const BIZ_B = "realtegic-works";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedVoiceNumber(businessId, provider, number, employeeId, status = "active") {
  await db.insert(schema.integrations).values({
    id: id("integration"),
    businessId,
    provider,
    status,
    externalPhoneNumberId: number,
    metadata: JSON.stringify({ kind: "voice_phone", employeeId: employeeId || "" }),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-voice-tenant-"));
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
  tenant = await import("@/lib/voice/tenant");

  const now = new Date();
  await db.insert(schema.businesses).values({ id: BIZ_A, name: "Kora OS", slug: BIZ_A, status: "active", createdAt: now, updatedAt: now });
  await db.insert(schema.businesses).values({ id: BIZ_B, name: "Realtegic Works", slug: BIZ_B, status: "active", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("resolves businessId + employeeId for an active, registered number", async () => {
  const number = "+15550001111";
  await seedVoiceNumber(BIZ_A, "plivo", number, "emp-receptionist");
  const result = await tenant.resolveVoiceIntegrationByPhoneNumber("plivo", number);
  assert.ok(result);
  assert.equal(result.businessId, BIZ_A);
  assert.equal(result.employeeId, "emp-receptionist");
});

test("returns null for a number with no registration at all", async () => {
  const result = await tenant.resolveVoiceIntegrationByPhoneNumber("plivo", "+15559999999");
  assert.equal(result, null);
});

test("returns null for a suspended (non-active) registration — never resolves a disabled number", async () => {
  const number = "+15550002222";
  await seedVoiceNumber(BIZ_A, "plivo", number, "emp-x", "suspended");
  const result = await tenant.resolveVoiceIntegrationByPhoneNumber("plivo", number);
  assert.equal(result, null);
});

test("TENANT ISOLATION: the same number registered under different providers resolves independently, never cross-provider", async () => {
  const number = "+15550003333";
  await seedVoiceNumber(BIZ_A, "plivo", number, "emp-a");
  await seedVoiceNumber(BIZ_B, "twilio", number, "emp-b");
  const plivoResult = await tenant.resolveVoiceIntegrationByPhoneNumber("plivo", number);
  const twilioResult = await tenant.resolveVoiceIntegrationByPhoneNumber("twilio", number);
  assert.equal(plivoResult.businessId, BIZ_A);
  assert.equal(twilioResult.businessId, BIZ_B);
});

test("normalizes formatting differences (spaces/dashes) to the same registered number", async () => {
  const canonical = "+15550004444";
  await seedVoiceNumber(BIZ_A, "plivo", canonical, "emp-a");
  const result = await tenant.resolveVoiceIntegrationByPhoneNumber("plivo", "+1 (555) 000-4444");
  assert.ok(result);
  assert.equal(result.businessId, BIZ_A);
});

test("returns null employeeId (not an error) for a registered number with no employee assigned yet", async () => {
  const number = "+15550005555";
  await seedVoiceNumber(BIZ_A, "plivo", number, "");
  const result = await tenant.resolveVoiceIntegrationByPhoneNumber("plivo", number);
  assert.ok(result);
  assert.equal(result.employeeId, null);
});

// --- isPhoneNumberAlreadyRegistered (Phase 7's cross-tenant uniqueness check) ---

test("a number already registered to another business is reported as taken", async () => {
  const number = "+15550006666";
  await seedVoiceNumber(BIZ_A, "plivo", number, "emp-a");
  assert.equal(await tenant.isPhoneNumberAlreadyRegistered("plivo", number, BIZ_B), true);
});

test("a business's OWN existing registration is excluded — re-saving/updating your own number is not a conflict", async () => {
  const number = "+15550007777";
  await seedVoiceNumber(BIZ_A, "plivo", number, "emp-a");
  assert.equal(await tenant.isPhoneNumberAlreadyRegistered("plivo", number, BIZ_A), false);
});

test("a genuinely unregistered number is never reported as taken", async () => {
  assert.equal(await tenant.isPhoneNumberAlreadyRegistered("plivo", "+15550008888", BIZ_A), false);
});
