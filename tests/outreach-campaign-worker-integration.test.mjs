// Real-implementation-path tests for lib/outreach/process-send.ts — the
// worker order-of-operations orchestrator. Mirrors
// tests/outreach-campaign-engine-integration.test.mjs: imports the ACTUAL
// production modules via the alias-resolving Node loader, against a real,
// disposable local SQLite database.
//
// RESEND_API_KEY is deliberately left unset in this test environment, so
// any send that reaches the provider call fails deterministically with a
// retryable network_error (getResend() throws for a missing key, caught by
// sendCampaignEmail's try/catch) — this is used below to exercise the
// "everything up to the provider call is correct" path without making a
// live network call, matching the existing WhatsApp integration suite's
// convention of never invoking a live external send.
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
let db, schema, suppression, processSend;

const BIZ = "worker-biz";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedScenario(overrides = {}) {
  const now = new Date();
  const campaignId = id("camp");
  const stepId = id("step");
  const step2Id = id("step2");
  const recipientId = id("recip");
  const contactId = id("contact");
  const prospectId = id("prospect");

  // outreach_contacts.prospect_id is NOT NULL in the (unchanged) Outreach
  // Intelligence schema — every contact today is discovered through a
  // researched prospect.
  await db.insert(schema.outreachProspects).values({
    id: prospectId,
    businessId: BIZ,
    employeeId: "emp-outreach",
    companyName: "Test Co",
    normalizedCompanyName: "test co",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachContacts).values({
    id: contactId,
    businessId: BIZ,
    prospectId,
    email: overrides.email ?? "target@example.com",
    contactType: "business",
    doNotContact: overrides.doNotContact ?? false,
    consentStatus: overrides.consentStatus ?? "unknown",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachCampaigns).values({
    id: campaignId,
    businessId: BIZ,
    employeeId: "emp-outreach",
    name: "Test campaign",
    status: overrides.campaignStatus ?? "running",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.outreachSequenceSteps).values([
    {
      id: stepId,
      businessId: BIZ,
      campaignId,
      stepNumber: 1,
      delayHours: 0,
      subjectTemplate: "Hi {{displayName}}",
      bodyTemplate: "Body for {{displayName}}",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: step2Id,
      businessId: BIZ,
      campaignId,
      stepNumber: 2,
      delayHours: 24,
      subjectTemplate: "Follow up",
      bodyTemplate: "Follow-up body",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.outreachCampaignRecipients).values({
    id: recipientId,
    businessId: BIZ,
    campaignId,
    contactId,
    prospectId,
    destinationChannel: "email",
    destinationIdentity: overrides.email ?? "target@example.com",
    displayName: "Target Person",
    status: overrides.recipientStatus ?? "scheduled",
    currentStepNumber: 1,
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const sendId = id("send");
  await db.insert(schema.outreachCampaignSends).values({
    id: sendId,
    businessId: BIZ,
    campaignId,
    recipientId,
    sequenceStepId: stepId,
    status: "scheduled",
    scheduledAt: now,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { campaignId, stepId, step2Id, recipientId, contactId, prospectId, sendId };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-campaign-worker-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "test-secret-for-campaign-worker-suite";
  process.env.EMAIL_FROM = process.env.EMAIL_FROM || "campaigns@superkuba.test";
  delete process.env.RESEND_API_KEY;

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  suppression = await import("@/lib/outreach/suppression");
  processSend = await import("@/lib/outreach/process-send");

  const now = new Date();
  await db.insert(schema.businesses).values({
    id: BIZ,
    name: "Worker Test Business",
    slug: BIZ,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("a send for a paused campaign is released back to scheduled, not dispatched, and stays recoverable (section 17)", async () => {
  const { sendId, recipientId } = await seedScenario({ campaignStatus: "paused" });
  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "cancelled_campaign_not_running");

  const sendRow = (await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.id, sendId)).limit(1))[0];
  // Recoverable, not cancelled/deleted — pause is not terminal.
  assert.equal(sendRow.status, "scheduled");
  assert.equal(sendRow.claimedBy, null);

  const recipientRow = (await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.id, recipientId)).limit(1))[0];
  assert.equal(recipientRow.status, "scheduled");
});

test("a send for a stopped campaign is cancelled and the recipient moves to a terminal state (section 18)", async () => {
  const { sendId, recipientId } = await seedScenario({ campaignStatus: "stopped" });
  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "cancelled_campaign_not_running");

  const sendRow = (await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.id, sendId)).limit(1))[0];
  assert.equal(sendRow.status, "cancelled");

  const recipientRow = (await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.id, recipientId)).limit(1))[0];
  assert.equal(recipientRow.status, "stopped");
});

test("a send for a recipient not in 'scheduled' state is cancelled, never dispatched", async () => {
  const { sendId } = await seedScenario({ recipientStatus: "suppressed" });
  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "cancelled_recipient_not_eligible");
});

test("a suppressed destination is never sent to, even if the campaign and recipient are otherwise eligible", async () => {
  const { sendId, recipientId } = await seedScenario({ email: "blocked@example.com" });
  await suppression.addSuppression({ businessId: BIZ, channel: "email", identity: "blocked@example.com", reason: "unsubscribed" });

  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "cancelled_suppressed");

  const recipientRow = (await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.id, recipientId)).limit(1))[0];
  assert.equal(recipientRow.status, "suppressed");
});

test("a contact with withdrawn consent is never sent to", async () => {
  const { sendId } = await seedScenario({ consentStatus: "withdrawn" });
  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "cancelled_consent");
});

test("a contact marked do-not-contact is never sent to, regardless of consentStatus", async () => {
  const { sendId } = await seedScenario({ doNotContact: true, consentStatus: "explicit" });
  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "cancelled_consent");
});

test("an eligible send reaches the provider call and fails safely (no RESEND_API_KEY in this test env), scheduling a retry rather than crashing", async () => {
  const { sendId } = await seedScenario();
  const result = await processSend.processClaimedSend(sendId);
  assert.equal(result.outcome, "retry_scheduled");

  const sendRow = (await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.id, sendId)).limit(1))[0];
  assert.equal(sendRow.status, "scheduled");
  assert.equal(sendRow.attemptCount, 1);
  assert.equal(sendRow.failureCode, "network_error");
  assert.ok(sendRow.nextAttemptAt);
  // Content is persisted BEFORE the provider call, so it survives even
  // though the call itself failed.
  assert.ok(sendRow.renderedBody.includes("Target Person"));
});

test("rendered content substitutes template variables", async () => {
  const { sendId } = await seedScenario();
  await processSend.processClaimedSend(sendId);
  const sendRow = (await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.id, sendId)).limit(1))[0];
  assert.match(sendRow.renderedSubject, /Hi Target Person/);
  assert.match(sendRow.renderedBody, /Body for Target Person/);
});

test("rendered content includes an unsubscribe link", async () => {
  const { sendId } = await seedScenario();
  await processSend.processClaimedSend(sendId);
  const sendRow = (await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.id, sendId)).limit(1))[0];
  assert.match(sendRow.renderedBody, /\/api\/outreach\/unsubscribe\?token=/);
});
