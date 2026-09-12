// Real-implementation-path tests for the Campaign CRUD service layer,
// recipient enrollment, campaign mutability rules, and launch/first-send
// scheduling (including scheduled-campaign activation under concurrency).
// Mirrors the alias-loader + real-sqlite pattern used by the other
// outreach-campaign-* integration suites.
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
let db, schema;
let campaignService, recipientEnrollment, campaignLifecycle, campaignMutability;

const BIZ_A = "crud-biz-a";
const BIZ_B = "crud-biz-b";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedContact(businessId, overrides = {}) {
  const now = new Date();
  const prospectId = id("prospect");
  const contactId = id("contact");
  await db.insert(schema.outreachProspects).values({
    id: prospectId,
    businessId,
    employeeId: "emp-outreach",
    companyName: "Co",
    normalizedCompanyName: "co",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachContacts).values({
    id: contactId,
    businessId,
    prospectId,
    email: overrides.email ?? `${contactId}@example.com`,
    contactType: "business",
    doNotContact: overrides.doNotContact ?? false,
    consentStatus: overrides.consentStatus ?? "unknown",
    createdAt: now,
    updatedAt: now,
  });
  return contactId;
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-campaign-crud-"));
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
  campaignService = await import("@/lib/outreach/campaign-service");
  recipientEnrollment = await import("@/lib/outreach/recipient-enrollment");
  campaignLifecycle = await import("@/lib/outreach/campaign-lifecycle");
  campaignMutability = await import("@/lib/outreach/campaign-mutability");

  const now = new Date();
  await db.insert(schema.businesses).values([
    { id: BIZ_A, name: "Business A", slug: BIZ_A, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_B, name: "Business B", slug: BIZ_B, status: "active", createdAt: now, updatedAt: now },
  ]);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Campaign mutability rules (centralized, section 2) ---

test("every field is editable on a draft, only name/description on scheduled, nothing once running/paused/completed/stopped/failed", () => {
  for (const field of ["name", "description", "sequence", "recipients", "personalization", "scheduling"]) {
    assert.equal(campaignMutability.isCampaignFieldEditable("draft", field), true);
  }
  assert.equal(campaignMutability.isCampaignFieldEditable("scheduled", "name"), true);
  assert.equal(campaignMutability.isCampaignFieldEditable("scheduled", "sequence"), false);
  for (const status of ["running", "paused", "completed", "stopped", "failed"]) {
    for (const field of ["name", "sequence", "recipients"]) {
      assert.equal(campaignMutability.isCampaignFieldEditable(status, field), false, `${status}/${field} must not be editable`);
    }
  }
});

test("only a draft campaign is deletable", () => {
  assert.equal(campaignMutability.isCampaignDeletable("draft"), true);
  for (const status of ["scheduled", "running", "paused", "completed", "stopped", "failed"]) {
    assert.equal(campaignMutability.isCampaignDeletable(status), false);
  }
});

// --- Campaign + sequence-step CRUD ---

test("a created campaign starts as a draft and is tenant-scoped", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "  Spring Launch  " });
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.name, "Spring Launch");

  await assert.rejects(campaignService.getCampaignOrThrow(BIZ_B, campaign.id), /not found/);
  const fetched = await campaignService.getCampaignOrThrow(BIZ_A, campaign.id);
  assert.equal(fetched.id, campaign.id);
});

test("sequence steps are appended with sequential step numbers and can be reordered/removed with renumbering", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Sequence test" });
  const step1 = await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, subjectTemplate: "S1", bodyTemplate: "B1" });
  const step2 = await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 24, subjectTemplate: "S2", bodyTemplate: "B2" });
  const step3 = await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 48, subjectTemplate: "S3", bodyTemplate: "B3" });

  let steps = await campaignService.listSequenceSteps(BIZ_A, campaign.id);
  assert.deepEqual(steps.map((s) => s.stepNumber), [1, 2, 3]);

  await campaignService.removeSequenceStep(BIZ_A, campaign.id, step2);
  steps = await campaignService.listSequenceSteps(BIZ_A, campaign.id);
  assert.deepEqual(steps.map((s) => s.id), [step1, step3]);
  assert.deepEqual(steps.map((s) => s.stepNumber), [1, 2], "removing a middle step must renumber the remainder contiguously");

  await campaignService.reorderSequenceSteps(BIZ_A, campaign.id, [step3, step1]);
  steps = await campaignService.listSequenceSteps(BIZ_A, campaign.id);
  assert.deepEqual(steps.map((s) => s.id), [step3, step1]);
});

test("editing sequence content is refused once the campaign is no longer a draft", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Locked once scheduled" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  const contactId = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);
  await campaignLifecycle.scheduleCampaign(BIZ_A, campaign.id, "user-1", new Date(Date.now() + 60_000));

  await assert.rejects(
    campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 1, bodyTemplate: "Too late" }),
    /Cannot edit "sequence"/,
  );
  // name/description remain editable while merely scheduled.
  await assert.doesNotReject(campaignService.updateCampaignFields(BIZ_A, campaign.id, { name: "Renamed while scheduled" }));
});

test("deleting a non-draft campaign is refused", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "To stop" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  const contactId = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);
  await campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1");
  await assert.rejects(campaignService.deleteDraftCampaign(BIZ_A, campaign.id), /Cannot delete/);
});

// --- Recipient enrollment (section 4) ---

test("bulk enrollment distinguishes enrolled / suppressed / ineligible / invalid_destination / wrong_tenant / already_enrolled outcomes", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Enrollment outcomes" });

  const goodContact = await seedContact(BIZ_A);
  const suppressedContact = await seedContact(BIZ_A, { email: "blocked-enroll@example.com" });
  const suppressionLib = await import("@/lib/outreach/suppression");
  await suppressionLib.addSuppression({ businessId: BIZ_A, channel: "email", identity: "blocked-enroll@example.com", reason: "unsubscribed" });
  const ineligibleContact = await seedContact(BIZ_A, { doNotContact: true });
  const foreignContact = await seedContact(BIZ_B);

  const now = new Date();
  const noEmailContactId = id("contact");
  const noEmailProspectId = id("prospect");
  await db.insert(schema.outreachProspects).values({ id: noEmailProspectId, businessId: BIZ_A, employeeId: "emp-outreach", companyName: "No Email Co", normalizedCompanyName: "no email co", createdAt: now, updatedAt: now });
  await db.insert(schema.outreachContacts).values({ id: noEmailContactId, businessId: BIZ_A, prospectId: noEmailProspectId, email: null, contactType: "business", createdAt: now, updatedAt: now });

  const results = await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [
    goodContact,
    suppressedContact,
    ineligibleContact,
    foreignContact,
    noEmailContactId,
  ]);

  const outcomeFor = (contactId) => results.find((r) => r.contactId === contactId).outcome;
  assert.equal(outcomeFor(goodContact), "enrolled");
  assert.equal(outcomeFor(suppressedContact), "suppressed");
  assert.equal(outcomeFor(ineligibleContact), "ineligible");
  assert.equal(outcomeFor(foreignContact), "wrong_tenant");
  assert.equal(outcomeFor(noEmailContactId), "invalid_destination");

  const again = await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [goodContact]);
  assert.equal(again[0].outcome, "already_enrolled");
});

test("one bad contact does not fail the rest of a bulk enrollment batch", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Batch resilience" });
  const good1 = await seedContact(BIZ_A);
  const good2 = await seedContact(BIZ_A);
  const results = await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [good1, "does-not-exist", good2]);
  assert.equal(results.find((r) => r.contactId === good1).outcome, "enrolled");
  assert.equal(results.find((r) => r.contactId === good2).outcome, "enrolled");
  assert.equal(results.find((r) => r.contactId === "does-not-exist").outcome, "wrong_tenant");
});

test("a recipient can be removed before launch, but not after", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Remove before launch" });
  const contactId = await seedContact(BIZ_A);
  const [{ recipientId }] = await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);
  await assert.doesNotReject(recipientEnrollment.removeRecipientBeforeLaunch(BIZ_A, campaign.id, recipientId));

  const contactId2 = await seedContact(BIZ_A);
  const [{ recipientId: recipientId2 }] = await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId2]);
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  await campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1");
  await assert.rejects(recipientEnrollment.removeRecipientBeforeLaunch(BIZ_A, campaign.id, recipientId2), /before launch/);
});

// --- Launch / first-send scheduling (section 5) ---

test("launching without any sequence step fails safely and never transitions the campaign", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "No steps" });
  const contactId = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);

  await assert.rejects(campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1"), /no sequence steps/);
  const reloaded = await campaignService.getCampaignOrThrow(BIZ_A, campaign.id);
  assert.equal(reloaded.status, "draft");
});

test("launching with zero eligible recipients fails safely and never transitions the campaign", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "No recipients" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });

  await assert.rejects(campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1"), /zero eligible recipients/);
  const reloaded = await campaignService.getCampaignOrThrow(BIZ_A, campaign.id);
  assert.equal(reloaded.status, "draft");
});

test("a successful launch creates exactly one first-step send job per ready recipient and moves them to scheduled", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Real launch" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  const contactA = await seedContact(BIZ_A);
  const contactB = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactA, contactB]);

  await campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1");

  const reloaded = await campaignService.getCampaignOrThrow(BIZ_A, campaign.id);
  assert.equal(reloaded.status, "running");
  assert.equal(reloaded.launchedBy, "user-1");
  assert.ok(reloaded.launchedAt);

  const sends = await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.campaignId, campaign.id));
  assert.equal(sends.length, 2);

  const recipients = await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.campaignId, campaign.id));
  assert.ok(recipients.every((r) => r.status === "scheduled"));
});

test("launching twice never duplicates send jobs (the state machine itself refuses the second launch)", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Double launch guard" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  const contactId = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);

  await campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1");
  await assert.rejects(campaignLifecycle.launchCampaignNow(BIZ_A, campaign.id, "user-1"));

  const sends = await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.campaignId, campaign.id));
  assert.equal(sends.length, 1);
});

// --- Scheduled campaign activation (section 6) ---

test("activateScheduledCampaign only fires once even when called concurrently for the same campaign", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Concurrent activation" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  const contactId = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);
  await campaignLifecycle.scheduleCampaign(BIZ_A, campaign.id, "user-1", new Date(Date.now() + 60_000));

  const now = new Date();
  const [first, second] = await Promise.all([
    campaignLifecycle.activateScheduledCampaign(BIZ_A, campaign.id, now),
    campaignLifecycle.activateScheduledCampaign(BIZ_A, campaign.id, now),
  ]);
  assert.equal([first, second].filter(Boolean).length, 1, "exactly one of the two concurrent calls should win the activation race");

  const sends = await db.select().from(schema.outreachCampaignSends).where(eq(schema.outreachCampaignSends.campaignId, campaign.id));
  assert.equal(sends.length, 1);
});

test("a stopped campaign is never (re-)activated by the scheduled-campaign sweep", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Stopped before due" });
  await campaignService.addSequenceStep(BIZ_A, campaign.id, { delayHours: 0, bodyTemplate: "Body" });
  const contactId = await seedContact(BIZ_A);
  await recipientEnrollment.enrollRecipients(BIZ_A, campaign.id, [contactId]);
  await campaignLifecycle.scheduleCampaign(BIZ_A, campaign.id, "user-1", new Date(Date.now() + 60_000));
  await db.update(schema.outreachCampaigns).set({ status: "stopped" }).where(eq(schema.outreachCampaigns.id, campaign.id));

  const activated = await campaignLifecycle.activateScheduledCampaign(BIZ_A, campaign.id);
  assert.equal(activated, false);
});

test("activation with no sequence step fails observably (campaign becomes failed, not stuck)", async () => {
  const campaign = await campaignService.createCampaign({ businessId: BIZ_A, employeeId: "emp-outreach", name: "Bad scheduled campaign" });
  // Force it into "scheduled" without ever passing launchCampaign's own
  // preflight (simulates data that reached this state some other way).
  await db.update(schema.outreachCampaigns).set({ status: "scheduled", scheduledAt: new Date() }).where(eq(schema.outreachCampaigns.id, campaign.id));

  const activated = await campaignLifecycle.activateScheduledCampaign(BIZ_A, campaign.id);
  assert.equal(activated, false);
  const reloaded = await campaignService.getCampaignOrThrow(BIZ_A, campaign.id);
  assert.equal(reloaded.status, "failed");
  assert.match(reloaded.failureReason, /no sequence steps/);
});
