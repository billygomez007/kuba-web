// Real implementation-path tests for Marketing 6A-4B Campaign Operations.
// Uses a disposable local SQLite database only — never staging/production.
// Authenticated Next.js route wiring is verified statically because the
// handlers depend on next/headers-backed membership/session resolution.

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db;
let schema;
let getMarketingCampaignOperations;

const BIZ_A = "campaign-ops-biz-a";
const BIZ_B = "campaign-ops-biz-b";
const CAMPAIGN_A = "campaign-ops-a";
const CAMPAIGN_B = "campaign-ops-b";
const CONTENT_A = "campaign-content-a";
const CONTENT_B = "campaign-content-b";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-marketing-campaign-ops-"));
  const databasePath = path.join(tempDir, "database.db");

  execFileSync(
    "node",
    [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`,
        CLEAN_BOOTSTRAP_KEEP: "1",
      },
      stdio: "pipe",
    },
  );

  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  ({ getMarketingCampaignOperations } = await import(
    "@/lib/marketing/campaign-operations"
  ));

  const now = new Date();
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(schema.users).values([
    {
      id: "requester-a",
      name: "Requester A",
      email: "requester-a@example.test",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "reviewer-a",
      name: "Reviewer A",
      email: "reviewer-a@example.test",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingAudiences).values([
    {
      id: "audience-a",
      businessId: BIZ_A,
      name: "Business A Audience",
      status: "ready",
      estimatedCount: 125,
      createdBy: "requester-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "audience-b",
      businessId: BIZ_B,
      name: "Business B Secret Audience",
      status: "ready",
      estimatedCount: 999,
      createdBy: "requester-a",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingAudienceRules).values([
    {
      id: "audience-rule-a",
      businessId: BIZ_A,
      audienceId: "audience-a",
      field: "lead_stage",
      operator: "equals",
      value: "qualified",
      position: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "audience-rule-b",
      businessId: BIZ_B,
      audienceId: "audience-b",
      field: "lead_stage",
      operator: "equals",
      value: "secret",
      position: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingCampaigns).values([
    {
      id: CAMPAIGN_A,
      businessId: BIZ_A,
      name: "Business A Campaign",
      objective: "lead_generation",
      campaignType: "organic",
      status: "pending_approval",
      targetAudienceId: "audience-a",
      budgetCurrency: "GHS",
      approvalStatus: "pending",
      createdByUserId: "requester-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: CAMPAIGN_B,
      businessId: BIZ_B,
      name: "Business B Secret Campaign",
      objective: "sales",
      campaignType: "organic",
      status: "active",
      targetAudienceId: "audience-b",
      budgetCurrency: "USD",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingCampaignChannels).values([
    {
      id: "channel-a",
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      channel: "instagram",
      status: "planned",
      audienceId: "audience-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "channel-b",
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      channel: "facebook",
      status: "active",
      audienceId: "audience-b",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingContentItems).values([
    {
      id: CONTENT_A,
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      title: "Business A Instagram Post",
      contentType: "post",
      status: "draft",
      approvalStatus: "pending",
      createdByUserId: "requester-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: CONTENT_B,
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      title: "Business B Secret Post",
      contentType: "post",
      status: "approved",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingContentVariants).values([
    {
      id: "variant-a",
      businessId: BIZ_A,
      contentItemId: CONTENT_A,
      channel: "instagram",
      headline: "Real persisted headline",
      text: "Real persisted campaign copy",
      scheduledAt,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "variant-b",
      businessId: BIZ_B,
      contentItemId: CONTENT_B,
      channel: "facebook",
      headline: "Business B Secret Headline",
      text: "Business B Secret Copy",
      status: "published",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingApprovals).values([
    {
      id: "campaign-approval-a",
      businessId: BIZ_A,
      resourceType: "campaign",
      resourceId: CAMPAIGN_A,
      status: "pending",
      requestedByUserId: "requester-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-approval-a",
      businessId: BIZ_A,
      resourceType: "content",
      resourceId: CONTENT_A,
      status: "pending",
      requestedByUserId: "requester-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "campaign-approval-b",
      businessId: BIZ_B,
      resourceType: "campaign",
      resourceId: CAMPAIGN_B,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingSocialAccounts).values([
    {
      id: "social-a",
      businessId: BIZ_A,
      provider: "instagram",
      displayName: "Business A Instagram",
      status: "connected",
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "social-b",
      businessId: BIZ_B,
      provider: "facebook",
      displayName: "Business B Secret Facebook",
      status: "connected",
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingPublishJobs).values([
    {
      id: "publish-a",
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      contentItemId: CONTENT_A,
      contentVariantId: "variant-a",
      socialAccountId: "social-a",
      channel: "instagram",
      scheduledAt,
      status: "scheduled",
      idempotencyKey: "campaign-ops-a-publish",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "publish-b",
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      contentItemId: CONTENT_B,
      contentVariantId: "variant-b",
      socialAccountId: "social-b",
      channel: "facebook",
      scheduledAt,
      status: "published",
      idempotencyKey: "campaign-ops-b-publish",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingAttributions).values([
    {
      id: "attribution-a",
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      leadId: "lead-a",
      eventType: "conversion",
      occurredAt: now,
      value: 250,
      currency: "GHS",
      createdAt: now,
    },
    {
      id: "attribution-b",
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      leadId: "lead-b",
      eventType: "conversion",
      occurredAt: now,
      value: 9999,
      currency: "USD",
      createdAt: now,
    },
  ]);

  await db.insert(schema.marketingMetricSnapshots).values([
    {
      id: "metric-a",
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      metric: "clicks",
      value: 17,
      capturedAt: now,
      createdAt: now,
    },
    {
      id: "metric-b",
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      metric: "clicks",
      value: 999,
      capturedAt: now,
      createdAt: now,
    },
  ]);

  await db.insert(schema.auditLogs).values([
    {
      id: "audit-a",
      businessId: BIZ_A,
      userId: "requester-a",
      action: "marketing.campaign.approval_requested",
      resource: "marketing_campaign",
      resourceId: CAMPAIGN_A,
      description: "Marketing campaign approval requested.",
      createdAt: now,
    },
    {
      id: "audit-b",
      businessId: BIZ_B,
      action: "marketing.campaign.created",
      resource: "marketing_campaign",
      resourceId: CAMPAIGN_B,
      description: "Business B secret activity.",
      createdAt: now,
    },
  ]);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("campaign operations returns the real persisted campaign and its native execution records", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_A);

  assert.ok(operations);
  assert.equal(operations.campaign.id, CAMPAIGN_A);
  assert.equal(operations.campaign.name, "Business A Campaign");
  assert.equal(operations.channels.length, 1);
  assert.equal(operations.content.length, 1);
  assert.equal(operations.variants.length, 1);
  assert.equal(operations.publishJobs.length, 1);
  assert.equal(operations.attributions.length, 1);
  assert.equal(operations.metrics.length, 1);
  assert.equal(operations.socialAccounts.length, 1);
});

test("campaign operations resolves only the persisted selected audience and its real rules", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_A);

  assert.equal(operations.audience.id, "audience-a");
  assert.equal(operations.audience.name, "Business A Audience");
  assert.equal(operations.audience.estimatedCount, 125);
  assert.equal(operations.audienceRules.length, 1);
  assert.equal(operations.audienceRules[0].value, "qualified");
});

test("campaign operations includes campaign and content approval history for the selected campaign", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_A);
  const ids = operations.approvals.map((approval) => approval.id).sort();

  assert.deepEqual(ids, ["campaign-approval-a", "content-approval-a"]);
});

test("scheduled publishing relationships remain linked to the persisted campaign, content, variant and social account", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_A);
  const job = operations.publishJobs[0];

  assert.equal(job.campaignId, CAMPAIGN_A);
  assert.equal(job.contentItemId, CONTENT_A);
  assert.equal(job.contentVariantId, "variant-a");
  assert.equal(job.socialAccountId, "social-a");
  assert.equal(job.channel, "instagram");
  assert.equal(job.status, "scheduled");
});

test("attribution and analytics expose persisted values only", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_A);

  assert.equal(operations.attributions[0].eventType, "conversion");
  assert.equal(operations.attributions[0].value, 250);
  assert.equal(operations.attributions[0].currency, "GHS");

  assert.equal(operations.metrics[0].metric, "clicks");
  assert.equal(operations.metrics[0].value, 17);

  assert.equal(
    operations.metrics.some((metric) =>
      ["impressions", "ctr", "cpc", "roas"].includes(metric.metric),
    ),
    false,
    "provider metrics that were never persisted must not be invented",
  );
});

test("CROSS-TENANT READ: business A cannot fetch business B's campaign by knowing its ID", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_B);
  assert.equal(operations, null);
});

test("TENANT ISOLATION: business A campaign operations never leak business B records", async () => {
  const operations = await getMarketingCampaignOperations(BIZ_A, CAMPAIGN_A);

  const serialized = JSON.stringify(operations);

  assert.doesNotMatch(serialized, /Business B Secret/);
  assert.doesNotMatch(serialized, /"id":"campaign-ops-b"/);
  assert.doesNotMatch(serialized, /content-b/);
  assert.doesNotMatch(serialized, /attribution-b/);
  assert.doesNotMatch(serialized, /metric-b/);
  assert.doesNotMatch(serialized, /publish-b/);
  assert.doesNotMatch(serialized, /social-b/);
});

test("NO INVENTED DATA: empty campaign relationships stay empty instead of receiving fabricated operational data", async () => {
  const now = new Date();

  await db.insert(schema.marketingCampaigns).values({
    id: "campaign-empty-a",
    businessId: BIZ_A,
    name: "Empty Campaign",
    objective: "other",
    campaignType: "organic",
    status: "draft",
    budgetCurrency: "GHS",
    approvalStatus: "draft",
    createdAt: now,
    updatedAt: now,
  });

  const operations = await getMarketingCampaignOperations(
    BIZ_A,
    "campaign-empty-a",
  );

  assert.ok(operations);
  assert.equal(operations.audience, null);
  assert.deepEqual(operations.audienceRules, []);
  assert.deepEqual(operations.channels, []);
  assert.deepEqual(operations.content, []);
  assert.deepEqual(operations.variants, []);
  assert.deepEqual(operations.approvals, []);
  assert.deepEqual(operations.publishJobs, []);
  assert.deepEqual(operations.attributions, []);
  assert.deepEqual(operations.metrics, []);
  assert.deepEqual(operations.activity, []);
});

test("campaign detail route derives tenant scope server-side and exposes server-derived capabilities", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/campaigns/[id]/route.ts"),
    "utf8",
  );

  assert.match(source, /requireMarketingAccess\("view"\)/);
  assert.match(
    source,
    /getMarketingCampaignOperations\(\s*access\.businessId,\s*id,\s*\)/,
  );
  assert.match(source, /capabilities:\s*access\.capabilities/);
  assert.match(source, /currentUserId:\s*access\.userId/);
  assert.doesNotMatch(
    source,
    /searchParams.*businessId|body\.businessId|body\["businessId"\]/,
  );
});

test("campaign PATCH cannot directly submit or approve an approval-controlled lifecycle state", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/campaigns/[id]/route.ts"),
    "utf8",
  );

  assert.match(source, /body\.status === "pending_approval"/);
  assert.match(
    source,
    /Campaign approval must be requested through the Marketing approval workflow/,
  );
  assert.match(
    source,
    /Campaign approval must be completed through the Marketing approval review workflow/,
  );
  assert.match(source, /assertCampaignTransition/);
});

test("content PATCH cannot directly mutate approvalStatus", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/content/[id]/route.ts"),
    "utf8",
  );

  assert.match(source, /"approvalStatus" in body/);
  assert.match(
    source,
    /Content approval status is controlled by the Marketing approval workflow/,
  );

  const allowedMatch = source.match(/for \(const key of \[([^\]]+)\]/);
  assert.ok(allowedMatch);
  assert.doesNotMatch(allowedMatch[1], /approvalStatus/);
});

test("approval review route requires dedicated review permission, forbids self-review and uses pending-state CAS", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/approvals/[id]/route.ts"),
    "utf8",
  );

  assert.match(source, /requireMarketingAccess\("review"\)/);
  assert.match(source, /existing\.requestedByUserId === access\.userId/);
  assert.match(source, /existing\.status !== "pending"/);
  assert.match(
    source,
    /eq\(marketingApprovals\.status,\s*"pending"\)/,
  );
  assert.match(source, /rowsAffected === 0/);
  assert.match(source, /db\.transaction/);
});

test("approval request route owns pending campaign transition and validates selected-business resource ownership", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/approvals/route.ts"),
    "utf8",
  );

  assert.match(source, /requireMarketingAccess\("manage"\)/);
  assert.match(source, /marketingCampaignBelongsToBusiness/);
  assert.match(source, /marketingContentBelongsToBusiness/);
  assert.match(source, /status:\s*"pending_approval"/);
  assert.match(source, /approvalStatus:\s*"pending"/);
  assert.match(source, /db\.transaction/);
});

test("publish-job creation validates every referenced business-scoped resource before persistence", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/publish-jobs/route.ts"),
    "utf8",
  );

  assert.match(source, /marketingContentBelongsToBusiness/);
  assert.match(source, /marketingCampaignBelongsToBusiness/);
  assert.match(source, /marketingVariantBelongsToBusiness/);
  assert.match(source, /marketingSocialAccountBelongsToBusiness/);
  assert.match(source, /PUBLISHING_ADAPTER_UNAVAILABLE/);
  assert.doesNotMatch(source, /status:\s*["']published["']/);
});

test("campaign operations UI gates lifecycle and approval review controls with server-derived capabilities", async () => {
  const source = await readFile(
    path.join(
      REPO_ROOT,
      "app/dashboard/marketing/campaigns/[id]/CampaignOperations.tsx",
    ),
    "utf8",
  );

  assert.match(source, /data\.capabilities\.canManage/);
  assert.match(source, /data\.capabilities\.canReviewApprovals/);
  assert.match(
    source,
    /row\.requestedByUserId !== data\.currentUserId/,
  );
  assert.match(source, /\/api\/marketing\/approvals\/\$\{approvalId\}/);
  assert.match(source, /"changes_requested"/);
  assert.match(source, /"rejected"/);
  assert.match(source, /"approved"/);
});
