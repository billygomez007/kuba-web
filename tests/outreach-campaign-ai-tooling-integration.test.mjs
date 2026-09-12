// Real-implementation-path tests for the Outreach Campaign Engine's
// AI-facing tools (mastra/tools/outreach-campaign-tools.ts). Mirrors
// tests/outreach-research-pipeline.test.mjs's pattern for constructing a
// trusted RequestContext and invoking a Mastra tool's execute() directly.
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

let db, schema, RequestContext;
let createCampaignDraftTool, addResearchedContactsToCampaignTool, proposeSequenceStepTool, summarizeCampaignTool;

let tempDir;
const BIZ = "biz-campaign-tools";
const EMPLOYEE_A = "emp-outreach-a";
const EMPLOYEE_B = "emp-outreach-b";

function trustedContext(employeeId) {
  return new RequestContext([
    ["businessId", BIZ],
    ["employeeId", employeeId],
  ]);
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-campaign-ai-tools-"));
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
  ({ RequestContext } = await import("@mastra/core/request-context"));
  ({
    createCampaignDraftTool,
    addResearchedContactsToCampaignTool,
    proposeSequenceStepTool,
    summarizeCampaignTool,
  } = await import("@/mastra/tools/outreach-campaign-tools"));

  const now = new Date();
  await db.insert(schema.businesses).values({ id: BIZ, name: "Tools Biz", slug: BIZ, status: "active", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("createCampaignDraft creates a real draft campaign scoped to the trusted business/employee", async () => {
  const result = await createCampaignDraftTool.execute(
    { name: "AI-created campaign", channel: "email" },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );
  assert.equal(result.success, true);
  assert.equal(result.status, "draft");
  assert.ok(result.campaignId);
});

test("proposeSequenceStep persists a real sequence step through addSequenceStep", async () => {
  const created = await createCampaignDraftTool.execute(
    { name: "Sequence campaign", channel: "email" },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );

  const step = await proposeSequenceStepTool.execute(
    { campaignId: created.campaignId, delayHours: 0, bodyTemplate: "Hi {{displayName}}" },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );
  assert.equal(step.success, true);
  assert.ok(step.stepId);

  const summary = await summarizeCampaignTool.execute(
    { campaignId: created.campaignId },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );
  assert.equal(summary.sequenceStepCount, 1);
});

test("a campaign tool refuses to act on a campaign owned by a different Outreach employee", async () => {
  const created = await createCampaignDraftTool.execute(
    { name: "Employee A's campaign", channel: "email" },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );

  await assert.rejects(
    proposeSequenceStepTool.execute(
      { campaignId: created.campaignId, delayHours: 0, bodyTemplate: "Should not be allowed" },
      { requestContext: trustedContext(EMPLOYEE_B) },
    ),
    /does not belong to the active Outreach employee/,
  );
});

test("addResearchedContactsToCampaign enrolls a real saved contact and returns its outcome", async () => {
  const now = new Date();
  const prospectId = `prospect-${Math.random().toString(36).slice(2, 8)}`;
  const contactId = `contact-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(schema.outreachProspects).values({
    id: prospectId,
    businessId: BIZ,
    employeeId: EMPLOYEE_A,
    companyName: "Real Co",
    normalizedCompanyName: "real co",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachContacts).values({
    id: contactId,
    businessId: BIZ,
    prospectId,
    email: "real-contact@example.com",
    contactType: "business",
    createdAt: now,
    updatedAt: now,
  });

  const created = await createCampaignDraftTool.execute(
    { name: "Enrollment campaign", channel: "email" },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );

  const enrolled = await addResearchedContactsToCampaignTool.execute(
    { campaignId: created.campaignId, contactIds: [contactId] },
    { requestContext: trustedContext(EMPLOYEE_A) },
  );
  assert.equal(enrolled.success, true);
  assert.equal(enrolled.results[0].outcome, "enrolled");
});

test("a tool call with no employeeId in requestContext throws rather than proceeding (server-pinned trust)", async () => {
  const untrusted = new RequestContext([["businessId", BIZ]]);
  await assert.rejects(
    createCampaignDraftTool.execute({ name: "Should fail", channel: "email" }, { requestContext: untrusted }),
  );
});
