// Focused tests for Kuba Marketing 6A-4C Content Operations.
// Uses disposable SQLite only. No staging or production data.

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
let getMarketingContentOperations;

const BIZ_A = "content-ops-biz-a";
const BIZ_B = "content-ops-biz-b";
const CONTENT_A = "content-ops-a";
const CONTENT_B = "content-ops-b";
const CAMPAIGN_A = "content-campaign-a";
const CAMPAIGN_B = "content-campaign-b";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-marketing-content-ops-"));
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
  ({ getMarketingContentOperations } = await import(
    "@/lib/marketing/content-operations"
  ));

  const now = new Date();
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(schema.users).values([
    {
      id: "content-user-a",
      name: "Content User A",
      email: "content-user-a@example.test",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-reviewer-a",
      name: "Content Reviewer A",
      email: "content-reviewer-a@example.test",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingCampaigns).values([
    {
      id: CAMPAIGN_A,
      businessId: BIZ_A,
      name: "Business A Campaign",
      objective: "awareness",
      campaignType: "organic",
      status: "active",
      budgetCurrency: "GHS",
      approvalStatus: "approved",
      createdByUserId: "content-user-a",
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
      budgetCurrency: "USD",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingContentItems).values([
    {
      id: CONTENT_A,
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      title: "Business A Content",
      contentType: "post",
      brief: "Real Business A content brief",
      status: "draft",
      approvalStatus: "pending",
      createdByUserId: "content-user-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: CONTENT_B,
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      title: "Business B Secret Content",
      contentType: "email",
      brief: "Secret Business B brief",
      status: "draft",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingContentVariants).values([
    {
      id: "content-variant-a",
      businessId: BIZ_A,
      contentItemId: CONTENT_A,
      channel: "instagram",
      headline: "Persisted headline",
      text: "Persisted Business A variant",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-variant-b",
      businessId: BIZ_B,
      contentItemId: CONTENT_B,
      channel: "facebook",
      headline: "Business B Secret Headline",
      text: "Business B Secret Variant",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingApprovals).values([
    {
      id: "content-approval-a",
      businessId: BIZ_A,
      resourceType: "content",
      resourceId: CONTENT_A,
      status: "pending",
      requestedByUserId: "content-user-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-approval-b",
      businessId: BIZ_B,
      resourceType: "content",
      resourceId: CONTENT_B,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingSocialAccounts).values([
    {
      id: "content-social-a",
      businessId: BIZ_A,
      provider: "instagram",
      displayName: "Business A Instagram",
      status: "connected",
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-social-b",
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
      id: "content-publish-a",
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      contentItemId: CONTENT_A,
      contentVariantId: "content-variant-a",
      socialAccountId: "content-social-a",
      channel: "instagram",
      scheduledAt,
      status: "scheduled",
      attemptCount: 0,
      idempotencyKey: "content-publish-a-key",
      failureCode: "PUBLISHING_ADAPTER_UNAVAILABLE",
      failureMessageSafe:
        "This channel is not connected to a publishing provider.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-publish-b",
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      contentItemId: CONTENT_B,
      contentVariantId: "content-variant-b",
      socialAccountId: "content-social-b",
      channel: "facebook",
      scheduledAt,
      status: "scheduled",
      attemptCount: 0,
      idempotencyKey: "content-publish-b-key",
      failureCode: "PUBLISHING_ADAPTER_UNAVAILABLE",
      failureMessageSafe: "Business B secret publishing state",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.marketingAssets).values([
    {
      id: "content-asset-a",
      businessId: BIZ_A,
      campaignId: CAMPAIGN_A,
      name: "Business A Campaign Asset",
      assetType: "image",
      fileReference: "asset-a.png",
      createdBy: "content-user-a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "content-asset-b",
      businessId: BIZ_B,
      campaignId: CAMPAIGN_B,
      name: "Business B Secret Asset",
      assetType: "image",
      fileReference: "asset-b.png",
      createdBy: "content-user-a",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.auditLogs).values([
    {
      id: "content-audit-a",
      businessId: BIZ_A,
      userId: "content-user-a",
      action: "marketing.content.approval_requested",
      resource: "marketing_content",
      resourceId: CONTENT_A,
      description: "Marketing content submitted for approval.",
      createdAt: now,
    },
    {
      id: "content-audit-b",
      businessId: BIZ_B,
      action: "marketing.content.created",
      resource: "marketing_content",
      resourceId: CONTENT_B,
      description: "Business B secret activity.",
      createdAt: now,
    },
  ]);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("content operations returns only real persisted records for the selected content", async () => {
  const operations = await getMarketingContentOperations(BIZ_A, CONTENT_A);

  assert.ok(operations);
  assert.equal(operations.content.id, CONTENT_A);
  assert.equal(operations.content.title, "Business A Content");
  assert.equal(operations.campaign.id, CAMPAIGN_A);
  assert.equal(operations.variants.length, 1);
  assert.equal(operations.approvals.length, 1);
  assert.equal(operations.publishJobs.length, 1);
  assert.equal(operations.assets.length, 1);
  assert.equal(operations.socialAccounts.length, 1);
});

test("CROSS-TENANT READ: business A cannot fetch business B content by knowing its ID", async () => {
  const operations = await getMarketingContentOperations(BIZ_A, CONTENT_B);
  assert.equal(operations, null);
});

test("TENANT ISOLATION: business A content operations never leak business B records", async () => {
  const operations = await getMarketingContentOperations(BIZ_A, CONTENT_A);
  const serialized = JSON.stringify(operations);

  assert.doesNotMatch(serialized, /Business B Secret/);
  assert.doesNotMatch(serialized, /content-variant-b/);
  assert.doesNotMatch(serialized, /content-publish-b/);
  assert.doesNotMatch(serialized, /content-social-b/);
  assert.doesNotMatch(serialized, /content-asset-b/);
});

test("publishing execution remains truthful and does not invent provider success", async () => {
  const operations = await getMarketingContentOperations(BIZ_A, CONTENT_A);
  const job = operations.publishJobs[0];

  assert.equal(job.status, "scheduled");
  assert.equal(job.providerPostId, null);
  assert.equal(job.publishedAt, null);
  assert.equal(job.failureCode, "PUBLISHING_ADAPTER_UNAVAILABLE");
});

test("NO INVENTED DATA: standalone empty content returns empty operational collections", async () => {
  const now = new Date();

  await db.insert(schema.marketingContentItems).values({
    id: "content-empty-a",
    businessId: BIZ_A,
    campaignId: null,
    title: "Empty Content",
    contentType: "post",
    status: "draft",
    approvalStatus: "draft",
    createdByUserId: "content-user-a",
    createdAt: now,
    updatedAt: now,
  });

  const operations = await getMarketingContentOperations(
    BIZ_A,
    "content-empty-a",
  );

  assert.ok(operations);
  assert.equal(operations.campaign, null);
  assert.deepEqual(operations.variants, []);
  assert.deepEqual(operations.approvals, []);
  assert.deepEqual(operations.publishJobs, []);
  assert.deepEqual(operations.assets, []);
  assert.deepEqual(operations.activity, []);
});

test("content detail route derives business scope server-side and exposes server-derived capabilities", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/content/[id]/route.ts"),
    "utf8",
  );

  assert.match(source, /requireMarketingAccess\("view"\)/);
  assert.match(
    source,
    /getMarketingContentOperations\(\s*access\.businessId,\s*id,\s*\)/,
  );
  assert.match(source, /capabilities:\s*access\.capabilities/);
  assert.match(source, /currentUserId:\s*access\.userId/);
  assert.doesNotMatch(
    source,
    /searchParams.*businessId|body\.businessId|body\["businessId"\]/,
  );
});

test("content creation records authenticated creator identity and validates content type", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/content/route.ts"),
    "utf8",
  );

  assert.match(source, /createdByUserId:\s*access\.userId/);
  assert.match(source, /isMarketingContentType/);
  assert.match(source, /Unsupported content type/);
  assert.match(source, /marketing\.content\.created/);
});

test("content PATCH cannot directly mutate approval status or content status", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/content/[id]/route.ts"),
    "utf8",
  );

  assert.match(source, /"approvalStatus" in body/);
  assert.match(source, /approval status is controlled/i);
  assert.match(source, /"status" in body/);
  assert.match(source, /status cannot be changed directly/i);
});

test("variant create route validates tenant, channel and uniqueness and blocks scheduling bypass", async () => {
  const source = await readFile(
    path.join(
      REPO_ROOT,
      "app/api/marketing/content/[id]/variants/route.ts",
    ),
    "utf8",
  );

  assert.match(source, /marketingContentBelongsToBusiness/);
  assert.match(source, /MARKETING_CHANNELS/);
  assert.match(source, /A variant already exists/);
  assert.match(source, /"scheduledAt" in body/);
  assert.match(source, /publishing workflow/);
  assert.match(source, /marketing\.content_variant\.created/);
});

test("variant PATCH enforces content ownership and immutable ownership/channel fields", async () => {
  const source = await readFile(
    path.join(
      REPO_ROOT,
      "app/api/marketing/content/[id]/variants/[variantId]/route.ts",
    ),
    "utf8",
  );

  assert.match(source, /marketingContentBelongsToBusiness/);
  assert.match(source, /marketingVariantBelongsToBusiness/);
  assert.match(source, /variant\.contentItemId !== id/);
  assert.match(source, /"businessId" in body/);
  assert.match(source, /"contentItemId" in body/);
  assert.match(source, /"channel" in body/);
  assert.match(source, /"scheduledAt" in body/);
  assert.match(source, /marketing\.content_variant\.updated/);
});

test("publish job creation validates content, campaign, variant and social account ownership", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/api/marketing/publish-jobs/route.ts"),
    "utf8",
  );

  assert.match(source, /marketingContentBelongsToBusiness/);
  assert.match(source, /marketingCampaignBelongsToBusiness/);
  assert.match(source, /marketingVariantBelongsToBusiness/);
  assert.match(source, /marketingSocialAccountBelongsToBusiness/);
  assert.match(source, /PUBLISHING_ADAPTER_UNAVAILABLE/);
  assert.match(source, /providerPostId:\s*null/);
  assert.match(source, /publishedAt:\s*null/);
});

test("content operations UI uses authoritative APIs and server-derived permissions", async () => {
  const source = await readFile(
    path.join(
      REPO_ROOT,
      "app/dashboard/marketing/content/[id]/ContentOperations.tsx",
    ),
    "utf8",
  );

  assert.match(source, /data\.capabilities\.canManage/);
  assert.match(source, /data\.capabilities\.canReviewApprovals/);
  assert.match(source, /row\.requestedByUserId !== data\.currentUserId|approval\.requestedByUserId !== data\.currentUserId/);
  assert.match(source, /\/api\/marketing\/approvals/);
  assert.match(source, /\/api\/marketing\/publish-jobs/);
  assert.match(source, /\/variants\/\$\{variantId\}/);
  assert.match(source, /PUBLISHING|Publishing|provider execution/i);
});

test("content operations UI does not claim provider publishing success without persisted evidence", async () => {
  const source = await readFile(
    path.join(
      REPO_ROOT,
      "app/dashboard/marketing/content/[id]/ContentOperations.tsx",
    ),
    "utf8",
  );

  assert.match(source, /failureCode/);
  assert.match(source, /failureMessageSafe/);
  assert.match(source, /No provider execution result recorded/);
  assert.doesNotMatch(source, /Successfully published/);
});

test("content policy contains the canonical accepted content types used by write routes", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "lib/marketing/content-policy.ts"),
    "utf8",
  );

  for (const type of [
    "post",
    "email",
    "article",
    "ad",
    "video",
    "story",
    "reel",
    "sms",
    "other",
  ]) {
    assert.match(source, new RegExp(`"${type}"`));
  }
});
