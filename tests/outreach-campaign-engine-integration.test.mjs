// Real-implementation-path tests for the Outreach Campaign Engine's
// suppression checks and durable send-worker (claim/lease/retry). Mirrors
// tests/whatsapp-integration.test.mjs: imports the ACTUAL production
// modules via the alias-resolving Node loader, against a real, disposable
// local SQLite database built from the repository's own schema.
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
import { eq } from "drizzle-orm";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, suppression, sendWorker;

const BIZ_A = "campaign-biz-a";
const BIZ_B = "campaign-biz-b";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedCampaignWithRecipientAndSend(businessId, overrides = {}) {
  const now = new Date();
  const campaignId = id("camp");
  const stepId = id("step");
  const recipientId = id("recip");
  const contactId = id("contact");
  const prospectId = id("prospect");

  await db.insert(schema.outreachProspects).values({
    id: prospectId,
    businessId,
    employeeId: "emp-outreach",
    companyName: "Acme Co",
    normalizedCompanyName: "acme co",
    researchStatus: "researched",
    qualificationStatus: "qualified",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachContacts).values({
    id: contactId,
    businessId,
    prospectId,
    email: "person@acme.example",
    contactType: "business",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachCampaigns).values({
    id: campaignId,
    businessId,
    employeeId: "emp-outreach",
    name: "Q1 outreach",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachSequenceSteps).values({
    id: stepId,
    businessId,
    campaignId,
    stepNumber: 1,
    delayHours: 0,
    subjectTemplate: "Hello {{name}}",
    bodyTemplate: "Body",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachCampaignRecipients).values({
    id: recipientId,
    businessId,
    campaignId,
    contactId,
    prospectId,
    destinationChannel: "email",
    destinationIdentity: "person@acme.example",
    status: "scheduled",
    currentStepNumber: 1,
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const sendId = id("send");
  await db.insert(schema.outreachCampaignSends).values({
    id: sendId,
    businessId,
    campaignId,
    recipientId,
    sequenceStepId: stepId,
    status: "scheduled",
    scheduledAt: overrides.scheduledAt ?? now,
    attemptCount: overrides.attemptCount ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  return { campaignId, stepId, recipientId, contactId, sendId };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-campaign-engine-"));
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
  suppression = await import("@/lib/outreach/suppression");
  sendWorker = await import("@/lib/outreach/send-worker");

  const now = new Date();
  await db.insert(schema.businesses).values([
    { id: BIZ_A, name: "Business A", slug: BIZ_A, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_B, name: "Business B", slug: BIZ_B, status: "active", createdAt: now, updatedAt: now },
  ]);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Suppression: normalization ---

test("email suppression is normalized to lowercase/trimmed, matching different casing", () => {
  assert.equal(
    suppression.normalizeEmailForSuppression("  Person@Acme.EXAMPLE "),
    "person@acme.example",
  );
});

test("phone suppression normalization strips formatting but keeps a leading +", () => {
  assert.equal(suppression.normalizePhoneForSuppression("+1 (555) 123-4567"), "+15551234567");
  assert.equal(suppression.normalizePhoneForSuppression("233 20 000 0000"), "233200000000");
});

// --- Suppression: business-scoped, checked, idempotent ---

test("a suppression is scoped to its business — never visible cross-tenant", async () => {
  await suppression.addSuppression({
    businessId: BIZ_A,
    channel: "email",
    identity: "shared@example.com",
    reason: "unsubscribed",
  });

  assert.equal(await suppression.isSuppressed(BIZ_A, "email", "shared@example.com"), true);
  assert.equal(await suppression.isSuppressed(BIZ_B, "email", "shared@example.com"), false);
});

test("adding the same suppression twice is idempotent (a repeated unsubscribe click never errors)", async () => {
  await suppression.addSuppression({
    businessId: BIZ_A,
    channel: "email",
    identity: "repeat@example.com",
    reason: "unsubscribed",
  });
  await assert.doesNotReject(
    suppression.addSuppression({
      businessId: BIZ_A,
      channel: "email",
      identity: "REPEAT@example.com", // different casing, same normalized identity
      reason: "unsubscribed",
    }),
  );
  assert.equal(await suppression.isSuppressed(BIZ_A, "email", "repeat@example.com"), true);
});

// --- Send worker: atomic claiming ---

test("a due send is claimed, and claiming again before the lease expires wins nothing", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, { scheduledAt: new Date(Date.now() - 1000) });

  const firstClaim = await sendWorker.claimDueSends("worker-1", 10);
  assert.ok(firstClaim.includes(sendId));

  const secondClaim = await sendWorker.claimDueSends("worker-2", 10);
  assert.equal(secondClaim.includes(sendId), false, "a live lease must not be claimable by a second worker");
});

test("an expired lease is reclaimable by a different worker (crashed-worker recovery)", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, { scheduledAt: new Date(Date.now() - 1000) });

  const claimed = await sendWorker.claimDueSends("worker-1", 10, 1); // 1ms lease
  assert.ok(claimed.includes(sendId));

  await new Promise((resolve) => setTimeout(resolve, 10));

  const reclaimed = await sendWorker.claimDueSends("worker-2", 10, 60_000);
  assert.ok(reclaimed.includes(sendId), "an expired lease must be reclaimable");
});

test("a send scheduled in the future is not claimed early", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, {
    scheduledAt: new Date(Date.now() + 60 * 60_000),
  });
  const claimed = await sendWorker.claimDueSends("worker-1", 50);
  assert.equal(claimed.includes(sendId), false);
});

// --- Send worker: idempotency at the database level ---

test("a second send row for the same recipient + sequence step is rejected by the unique index", async () => {
  const { recipientId, stepId } = await seedCampaignWithRecipientAndSend(BIZ_A);
  await assert.rejects(
    db.insert(schema.outreachCampaignSends).values({
      id: id("dupe-send"),
      businessId: BIZ_A,
      campaignId: id("unused"),
      recipientId,
      sequenceStepId: stepId,
      status: "scheduled",
      scheduledAt: new Date(),
      attemptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
});

// --- Send worker: success/failure outcomes ---

test("recordSendSuccess marks the send terminal and stores rendered content + external message id", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, { scheduledAt: new Date(Date.now() - 1000) });
  await sendWorker.claimDueSends("worker-1", 10);

  await sendWorker.recordSendSuccess(sendId, {
    externalMessageId: "resend-abc123",
    renderedSubject: "Hello Acme",
    renderedBody: "Body text",
    personalizationMetadata: JSON.stringify({ templateVersion: 1 }),
  });

  const rows = await db
    .select()
    .from(schema.outreachCampaignSends)
    .where(eq(schema.outreachCampaignSends.id, sendId))
    .limit(1);

  const row = rows[0];
  assert.equal(row.status, "sent");
  assert.equal(row.externalMessageId, "resend-abc123");
  assert.equal(row.renderedSubject, "Hello Acme");
  assert.equal(row.attemptCount, 1);
  assert.ok(row.completedAt);
});

test("a retryable failure under the attempt cap is rescheduled with backoff, not marked permanently failed", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, {
    scheduledAt: new Date(Date.now() - 1000),
    attemptCount: 0,
  });
  await sendWorker.claimDueSends("worker-1", 10);

  const outcome = await sendWorker.recordSendFailure(sendId, "provider_timeout", "Request timed out");
  assert.equal(outcome, "retry_scheduled");
});

test("a retryable failure that exhausts MAX_SEND_ATTEMPTS becomes dead_letter, not an infinite retry", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, {
    scheduledAt: new Date(Date.now() - 1000),
    attemptCount: sendWorker.MAX_SEND_ATTEMPTS - 1,
  });
  await sendWorker.claimDueSends("worker-1", 10);

  const outcome = await sendWorker.recordSendFailure(sendId, "provider_timeout", "Still timing out");
  assert.equal(outcome, "dead_letter");
});

test("a permanent failure is marked failed immediately regardless of attempt count", async () => {
  const { sendId } = await seedCampaignWithRecipientAndSend(BIZ_A, {
    scheduledAt: new Date(Date.now() - 1000),
    attemptCount: 0,
  });
  await sendWorker.claimDueSends("worker-1", 10);

  const outcome = await sendWorker.recordSendFailure(sendId, "invalid_recipient", "No such mailbox");
  assert.equal(outcome, "failed");
});

test("backoff is capped exponential, not unbounded", () => {
  assert.equal(sendWorker.computeBackoffMs(1), 60_000);
  assert.equal(sendWorker.computeBackoffMs(2), 120_000);
  assert.equal(sendWorker.computeBackoffMs(3), 240_000);
  assert.equal(sendWorker.computeBackoffMs(20), 60 * 60_000); // capped at 1h
});

test("failure code classification is exhaustive and disjoint", () => {
  for (const code of sendWorker.RETRYABLE_FAILURE_CODES) {
    assert.equal(sendWorker.isRetryableFailureCode(code), true);
  }
  for (const code of sendWorker.PERMANENT_FAILURE_CODES) {
    assert.equal(sendWorker.isRetryableFailureCode(code), false);
  }
});
