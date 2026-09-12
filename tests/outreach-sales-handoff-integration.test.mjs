// Real-implementation-path tests for the shared deterministic Sales
// handoff core (lib/outreach/sales-handoff.ts) and the campaign-reply
// handoff path (lib/outreach/campaign-reply-handoff.ts) — approved spec
// sections 10, 22, 35-36. Mirrors the alias-loader + real-sqlite pattern
// used by the other outreach-campaign-* integration suites.
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

let db, schema, salesHandoff, campaignReplyHandoff;

let tempDir;
const BIZ = "biz-sales-handoff";
const EMPLOYEE = "emp-outreach";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedProspectWithCampaignRecipient(overrides = {}) {
  const now = new Date();
  const prospectId = id("prospect");
  const contactId = id("contact");
  const campaignId = id("camp");
  const stepId = id("step");
  const recipientId = id("recip");

  await db.insert(schema.outreachProspects).values({
    id: prospectId,
    businessId: BIZ,
    employeeId: EMPLOYEE,
    companyName: overrides.companyName ?? "Reply Handoff Co",
    normalizedCompanyName: "reply handoff co",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachContacts).values({
    id: contactId,
    businessId: BIZ,
    prospectId,
    email: "reply-target@example.com",
    contactType: "business",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachCampaigns).values({
    id: campaignId,
    businessId: BIZ,
    employeeId: EMPLOYEE,
    name: "Reply campaign",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachSequenceSteps).values({
    id: stepId,
    businessId: BIZ,
    campaignId,
    stepNumber: 1,
    delayHours: 0,
    bodyTemplate: "Body",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachCampaignRecipients).values({
    id: recipientId,
    businessId: BIZ,
    campaignId,
    contactId,
    prospectId,
    destinationChannel: "email",
    destinationIdentity: "reply-target@example.com",
    status: overrides.recipientStatus ?? "scheduled",
    currentStepNumber: 1,
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // A pending step-2 send that should be cancelled once the reply is processed.
  const step2Id = id("step2");
  await db.insert(schema.outreachSequenceSteps).values({
    id: step2Id,
    businessId: BIZ,
    campaignId,
    stepNumber: 2,
    delayHours: 24,
    bodyTemplate: "Follow up",
    createdAt: now,
    updatedAt: now,
  });
  const pendingSendId = id("send");
  await db.insert(schema.outreachCampaignSends).values({
    id: pendingSendId,
    businessId: BIZ,
    campaignId,
    recipientId,
    sequenceStepId: step2Id,
    status: "scheduled",
    scheduledAt: new Date(now.getTime() + 24 * 60 * 60_000),
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { prospectId, contactId, campaignId, recipientId, pendingSendId };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-sales-handoff-"));
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
  salesHandoff = await import("@/lib/outreach/sales-handoff");
  campaignReplyHandoff = await import("@/lib/outreach/campaign-reply-handoff");

  const now = new Date();
  await db.insert(schema.businesses).values({ id: BIZ, name: "Handoff Biz", slug: BIZ, status: "active", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Shared deterministic core ---

test("promoteProspectToSales creates a lead for a campaign_reply_engagement reason with no ICP score required", async () => {
  const { prospectId } = await seedProspectWithCampaignRecipient();
  const result = await salesHandoff.promoteProspectToSales({
    businessId: BIZ,
    prospectId,
    employeeId: EMPLOYEE,
    reason: { type: "campaign_reply_engagement", campaignId: "camp-x", recipientId: "recip-x", replySummary: "Interested, please call me." },
    recommendedNextAction: "Call this week.",
  });
  assert.equal(result.success, true);
  assert.equal(result.created, true);
});

test("the same prospect can only ever be promoted once, regardless of which reason type reaches it first", async () => {
  const { prospectId } = await seedProspectWithCampaignRecipient();

  const first = await salesHandoff.promoteProspectToSales({
    businessId: BIZ,
    prospectId,
    employeeId: EMPLOYEE,
    reason: { type: "autonomous_research_qualification", icpFitScore: 90, qualificationReason: "Strong signal." },
    recommendedNextAction: "Reach out.",
  });
  assert.equal(first.created, true);

  const second = await salesHandoff.promoteProspectToSales({
    businessId: BIZ,
    prospectId,
    employeeId: EMPLOYEE,
    reason: { type: "campaign_reply_engagement", campaignId: "camp-x", recipientId: "recip-x", replySummary: "They replied too." },
    recommendedNextAction: "Follow up on the reply.",
  });
  assert.equal(second.created, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.lead.id, first.lead.id);
});

// --- Campaign reply handling (sections 35-36) ---

test("markRecipientReplied halts the sequence: cancels pending scheduled sends and marks the recipient replied", async () => {
  const { campaignId, recipientId, pendingSendId } = await seedProspectWithCampaignRecipient();

  await campaignReplyHandoff.markRecipientReplied(BIZ, campaignId, recipientId);

  const recipient = (await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.id, recipientId)).limit(1))[0];
  assert.equal(recipient.status, "replied");
  assert.ok(recipient.lastReplyAt);

  const pendingSend = (await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.id, pendingSendId)).limit(1))[0];
  assert.equal(pendingSend.status, "cancelled");
});

test("markRecipientReplied is idempotent — calling it twice does not error or double-process", async () => {
  const { campaignId, recipientId } = await seedProspectWithCampaignRecipient();
  await campaignReplyHandoff.markRecipientReplied(BIZ, campaignId, recipientId);
  await assert.doesNotReject(campaignReplyHandoff.markRecipientReplied(BIZ, campaignId, recipientId));
});

test("handleCampaignReplyHandoff requires markRecipientReplied to have already run", async () => {
  const { campaignId, recipientId } = await seedProspectWithCampaignRecipient();
  await assert.rejects(
    campaignReplyHandoff.handleCampaignReplyHandoff({
      businessId: BIZ,
      campaignId,
      recipientId,
      replySummary: "Reply text",
      recommendedNextAction: "Call them.",
    }),
  );
});

test("handleCampaignReplyHandoff promotes to Sales and marks the recipient handed_off, through the shared deterministic core", async () => {
  const { campaignId, recipientId } = await seedProspectWithCampaignRecipient();
  await campaignReplyHandoff.markRecipientReplied(BIZ, campaignId, recipientId);

  const result = await campaignReplyHandoff.handleCampaignReplyHandoff({
    businessId: BIZ,
    campaignId,
    recipientId,
    replySummary: "They want a demo.",
    recommendedNextAction: "Book a demo call.",
  });
  assert.equal(result.success, true);
  assert.equal(result.created, true);

  const recipient = (await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.id, recipientId)).limit(1))[0];
  assert.equal(recipient.status, "handed_off");
  assert.equal(recipient.handoffLeadId, result.lead.id);
});

test("processing the same reply twice results in exactly one Sales promotion (idempotent handoff)", async () => {
  const { campaignId, recipientId } = await seedProspectWithCampaignRecipient();
  await campaignReplyHandoff.markRecipientReplied(BIZ, campaignId, recipientId);

  const first = await campaignReplyHandoff.handleCampaignReplyHandoff({
    businessId: BIZ,
    campaignId,
    recipientId,
    replySummary: "Reply one.",
    recommendedNextAction: "Follow up.",
  });
  const second = await campaignReplyHandoff.handleCampaignReplyHandoff({
    businessId: BIZ,
    campaignId,
    recipientId,
    replySummary: "Reply one (duplicate webhook delivery).",
    recommendedNextAction: "Follow up.",
  });

  assert.equal(first.lead.id, second.lead.id);
  const leadRows = await db.select().from(schema.leads).where(eq(schema.leads.businessId, BIZ));
  const matching = leadRows.filter((row) => row.id === first.lead.id);
  assert.equal(matching.length, 1);
});
