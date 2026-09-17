// Real-implementation-path tests for the Kuba Marketing overview
// (/dashboard/marketing + GET /api/marketing/overview). Exercises the real
// aggregation logic in lib/marketing/overview.ts against a real, disposable
// local SQLite database — never Turso/superkuba-staging. Mirrors the
// conventions established in tests/ai-employee-marketing-appointment.test.mjs.
//
// The route handler itself (app/api/marketing/overview/route.ts) resolves
// the caller's business via next/headers-backed cookies/session, which
// can't be invoked directly outside a real request — matching this repo's
// established pattern (see tests/employee-workspace-tenant-scoping.test.mjs),
// its wiring is proven with static source assertions instead.
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
let db, schema;
let getMarketingOverview, mergeScheduledUnits;

const BIZ_A = "mkt-overview-biz-a";
const BIZ_B = "mkt-overview-biz-b";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-marketing-overview-"));
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
  ({ getMarketingOverview, mergeScheduledUnits } = await import("@/lib/marketing/overview"));

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const future = (offset) => new Date(now + offset);
  const past = (offset) => new Date(now - offset);

  await db.insert(schema.users).values({ id: "requester-1", name: "Priya Requester", email: "priya@mkt-overview.example", createdAt: new Date(now), updatedAt: new Date(now) });

  // --- Business A: the business under test ---
  const campaignsA = [
    { id: "camp-a-draft", name: "Draft Launch", status: "draft" },
    { id: "camp-a-planned", name: "Planned Launch", status: "planned" },
    { id: "camp-a-pending", name: "Pending Approval Launch", status: "pending_approval" },
    { id: "camp-a-approved", name: "Approved Launch", status: "approved" },
    { id: "camp-a-scheduled", name: "Scheduled Launch", status: "scheduled", startAt: future(day) },
    { id: "camp-a-active-1", name: "Active Spring Sale", status: "active", startAt: past(day), endAt: future(2 * day) },
    { id: "camp-a-active-2", name: "Active Referral Push", status: "active" },
    { id: "camp-a-paused", name: "Paused Push", status: "paused" },
  ];
  for (const campaign of campaignsA) {
    await db.insert(schema.marketingCampaigns).values({
      id: campaign.id, businessId: BIZ_A, name: campaign.name, objective: "other", campaignType: "organic", status: campaign.status,
      startAt: campaign.startAt ?? null, endAt: campaign.endAt ?? null, budgetCurrency: "USD", approvalStatus: "draft",
      createdAt: new Date(now), updatedAt: new Date(now),
    });
  }

  const contentItemsA = [
    { id: "content-a-1", title: "Spring Sale Post" },
    { id: "content-a-2", title: "Referral Email" },
    { id: "content-a-3", title: "Launch Teaser" },
    { id: "content-a-4", title: "Founder Story" },
    { id: "content-a-5", title: "Behind the Scenes" },
    { id: "content-a-6", title: "Customer Spotlight" },
  ];
  for (const item of contentItemsA) {
    await db.insert(schema.marketingContentItems).values({ id: item.id, businessId: BIZ_A, campaignId: "camp-a-active-1", title: item.title, contentType: "post", status: "draft", approvalStatus: "draft", createdAt: new Date(now), updatedAt: new Date(now) });
  }

  // Scheduled unit dedup fixture: variant "variant-a-covered" has a publish
  // job referencing it (must count as ONE scheduled unit, not two). Variant
  // "variant-a-alone" has no job (counts on its own). Job "job-a-standalone"
  // has no contentVariantId (counts on its own too).
  await db.insert(schema.marketingContentVariants).values([
    { id: "variant-a-covered", businessId: BIZ_A, contentItemId: "content-a-1", channel: "instagram", text: "Shop the sale", scheduledAt: future(2 * hour), status: "scheduled", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: "variant-a-alone", businessId: BIZ_A, contentItemId: "content-a-2", channel: "email", text: "Refer a friend", scheduledAt: future(3 * hour), status: "scheduled", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: "variant-a-past", businessId: BIZ_A, contentItemId: "content-a-3", channel: "facebook", text: "Already ran", scheduledAt: past(day), status: "scheduled", createdAt: new Date(now), updatedAt: new Date(now) },
  ]);
  await db.insert(schema.marketingPublishJobs).values([
    { id: "job-a-covers-variant", businessId: BIZ_A, contentItemId: "content-a-1", contentVariantId: "variant-a-covered", channel: "instagram", scheduledAt: future(2 * hour), status: "scheduled", idempotencyKey: "idem-1", failureCode: "PUBLISHING_ADAPTER_UNAVAILABLE", failureMessageSafe: "not connected", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: "job-a-standalone", businessId: BIZ_A, contentItemId: "content-a-3", contentVariantId: null, channel: "tiktok", scheduledAt: future(4 * hour), status: "scheduled", idempotencyKey: "idem-2", failureCode: "PUBLISHING_ADAPTER_UNAVAILABLE", failureMessageSafe: "not connected", createdAt: new Date(now), updatedAt: new Date(now) },
  ]);

  await db.insert(schema.marketingApprovals).values([
    { id: "approval-a-pending-1", businessId: BIZ_A, resourceType: "marketing_campaign", resourceId: "camp-a-pending", status: "pending", requestedByUserId: "requester-1", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: "approval-a-pending-2", businessId: BIZ_A, resourceType: "marketing_content_item", resourceId: "content-a-1", status: "pending", requestedByUserId: null, createdAt: new Date(now), updatedAt: new Date(now) },
    { id: "approval-a-resolved", businessId: BIZ_A, resourceType: "marketing_campaign", resourceId: "camp-a-approved", status: "approved", requestedByUserId: "requester-1", reviewedAt: new Date(now), createdAt: new Date(now), updatedAt: new Date(now) },
  ]);

  await db.insert(schema.marketingAudiences).values([
    { id: "audience-a-known", businessId: BIZ_A, name: "Repeat Customers", status: "ready", estimatedCount: 420, createdBy: "requester-1", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: "audience-a-unknown", businessId: BIZ_A, name: "New Leads", status: "draft", estimatedCount: null, createdBy: "requester-1", createdAt: new Date(now), updatedAt: new Date(now) },
  ]);

  await db.insert(schema.marketingSocialAccounts).values([
    { id: "social-a-instagram", businessId: BIZ_A, provider: "instagram", displayName: "Business A", status: "connected", createdAt: new Date(now), updatedAt: new Date(now) },
  ]);

  await db.insert(schema.marketingAttributions).values([
    { id: "attr-a-1", businessId: BIZ_A, campaignId: "camp-a-active-1", leadId: "lead-a-1", eventType: "click", occurredAt: new Date(now), createdAt: new Date(now) },
    { id: "attr-a-2", businessId: BIZ_A, campaignId: "camp-a-active-1", leadId: "lead-a-1", eventType: "conversion", occurredAt: new Date(now), createdAt: new Date(now) },
    { id: "attr-a-3", businessId: BIZ_A, campaignId: "camp-a-active-2", leadId: "lead-a-2", eventType: "click", occurredAt: new Date(now), createdAt: new Date(now) },
    { id: "attr-a-4", businessId: BIZ_A, campaignId: "camp-a-active-2", leadId: null, eventType: "impression", occurredAt: new Date(now), createdAt: new Date(now) },
  ]);

  await db.insert(schema.auditLogs).values([
    { id: "audit-a-1", businessId: BIZ_A, userId: "requester-1", action: "marketing.campaign.created", resource: "marketing_campaign", resourceId: "camp-a-active-1", description: "Marketing campaign created.", createdAt: new Date(now) },
  ]);

  // --- Business B: tenant-isolation control. No audit events at all. ---
  await db.insert(schema.marketingCampaigns).values({ id: "camp-b-1", businessId: BIZ_B, name: "Business B Only Campaign", objective: "other", campaignType: "organic", status: "active", budgetCurrency: "USD", approvalStatus: "draft", createdAt: new Date(now), updatedAt: new Date(now) });
  await db.insert(schema.marketingApprovals).values({ id: "approval-b-pending", businessId: BIZ_B, resourceType: "marketing_campaign", resourceId: "camp-b-1", status: "pending", requestedByUserId: null, createdAt: new Date(now), updatedAt: new Date(now) });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- mergeScheduledUnits: pure dedup logic ---

test("mergeScheduledUnits counts a variant covered by a publish job once, not twice", () => {
  const variants = [{ id: "v1", contentItemId: "c1", channel: "instagram", status: "scheduled", scheduledAt: new Date() }];
  const jobs = [{ id: "j1", contentItemId: "c1", contentVariantId: "v1", campaignId: null, channel: "instagram", status: "scheduled", scheduledAt: new Date() }];
  const units = mergeScheduledUnits(variants, jobs);
  assert.equal(units.length, 1);
  assert.equal(units[0].kind, "publish_job");
});

test("mergeScheduledUnits counts an uncovered variant and a standalone job separately", () => {
  const variants = [{ id: "v1", contentItemId: "c1", channel: "instagram", status: "scheduled", scheduledAt: new Date() }];
  const jobs = [{ id: "j1", contentItemId: "c2", contentVariantId: null, campaignId: null, channel: "tiktok", status: "scheduled", scheduledAt: new Date() }];
  const units = mergeScheduledUnits(variants, jobs);
  assert.equal(units.length, 2);
});

// --- getMarketingOverview: real implementation path ---

test("summary count contract: each metric matches the real, non-doubled native counts for this business only", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  assert.equal(overview.summary.activeCampaigns, 2, "only status === active campaigns count as active");
  assert.equal(overview.summary.contentPieces, 6);
  // 3 variants with scheduledAt set + 2 jobs with scheduledAt set, but
  // variant-a-covered and job-a-covers-variant are the SAME unit: alone (1)
  // + past (1) + covers-variant-job (1, representing the covered variant)
  // + standalone job (1) = 4 distinct units, not 5.
  assert.equal(overview.summary.scheduledContent, 4);
  assert.equal(overview.summary.pendingApprovals, 2, "resolved approval must not count as pending");
  assert.equal(overview.summary.leadsAttributed, 2, "distinct real leadIds only; null leadId attribution excluded");
});

test("TENANT SCOPING: business B's overview never contains business A's records", async () => {
  const overviewB = await getMarketingOverview(BIZ_B);
  assert.equal(overviewB.summary.activeCampaigns, 1);
  assert.equal(overviewB.summary.contentPieces, 0);
  assert.equal(overviewB.summary.scheduledContent, 0);
  assert.equal(overviewB.summary.pendingApprovals, 1);
  assert.equal(overviewB.recentCampaigns.every((c) => c.name !== "Draft Launch" && !c.id.startsWith("camp-a-")), true);
  assert.equal(overviewB.approvalQueue.every((a) => a.id !== "approval-a-pending-1" && a.id !== "approval-a-pending-2"), true);
});

test("CROSS-TENANT: business A's pending approval preview never leaks business B's approval", async () => {
  const overviewA = await getMarketingOverview(BIZ_A);
  assert.equal(overviewA.approvalQueue.some((a) => a.id === "approval-b-pending"), false);
});

test("null estimated audience count remains unavailable, never coerced to 0", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  const unknown = overview.audienceOverview.latest.find((a) => a.id === "audience-a-unknown");
  const known = overview.audienceOverview.latest.find((a) => a.id === "audience-a-known");
  assert.ok(unknown, "unknown-count audience must appear in the latest preview");
  assert.equal(unknown.estimatedCount, null);
  assert.equal(known.estimatedCount, 420);
});

test("channel with no persisted social account returns not_connected; a real connected row returns connected", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  const facebook = overview.channelReadiness.find((c) => c.provider === "facebook");
  const instagram = overview.channelReadiness.find((c) => c.provider === "instagram");
  assert.equal(facebook.state, "not_connected");
  assert.equal(instagram.state, "connected");
  assert.equal(overview.channelReadiness.length, 7, "exactly the 7 supported providers, always present");
});

test("upcoming activities are sorted chronologically, bounded, and exclude past-dated entries", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  assert.ok(overview.upcoming.length <= 10);
  for (let i = 1; i < overview.upcoming.length; i += 1) {
    assert.ok(new Date(overview.upcoming[i - 1].at).getTime() <= new Date(overview.upcoming[i].at).getTime(), "upcoming must be sorted ascending by time");
  }
  const now = Date.now();
  assert.ok(overview.upcoming.every((item) => new Date(item.at).getTime() >= now - 1000), "no past-dated activity should appear as upcoming");
  assert.equal(overview.upcoming.some((item) => item.id === "variant:variant-a-past"), false, "a scheduled unit in the past must not appear in upcoming");
});

test("bounded recent lists: recent campaigns and recent content never exceed 5, even though more exist", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  assert.equal(overview.recentCampaigns.length, 5, "8 campaigns exist for business A; the recent list must be bounded to 5");
  assert.equal(overview.recentContent.length, 5, "6 content items exist for business A; the recent list must be bounded to 5");
});

test("approval queue resolves a real requester name and a real resource name from persisted data only", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  const withRequester = overview.approvalQueue.find((a) => a.id === "approval-a-pending-1");
  const withoutRequester = overview.approvalQueue.find((a) => a.id === "approval-a-pending-2");
  assert.equal(withRequester.requesterName, "Priya Requester");
  assert.equal(withRequester.resourceName, "Pending Approval Launch");
  assert.equal(withoutRequester.requesterName, null, "an approval with no requestedByUserId must never get an invented requester name");
});

test("NO INVENTED ACTIVITY: a business with zero marketing audit events gets an empty array, never fabricated entries", async () => {
  const overviewB = await getMarketingOverview(BIZ_B);
  assert.deepEqual(overviewB.recentActivity, []);
});

test("recent activity reflects a real, genuine audit event when one exists for this business", async () => {
  const overviewA = await getMarketingOverview(BIZ_A);
  assert.ok(overviewA.recentActivity.length >= 1);
  assert.equal(overviewA.recentActivity[0].action, "marketing.campaign.created");
});

test("campaign activity only lists statuses that actually occur in persisted data, in lifecycle order, with real counts", async () => {
  const overview = await getMarketingOverview(BIZ_A);
  const statuses = overview.campaignActivity.map((bucket) => bucket.status);
  assert.deepEqual(statuses, ["draft", "planned", "pending_approval", "approved", "scheduled", "active", "paused"], "completed/cancelled never occurred for business A and must not appear");
  const active = overview.campaignActivity.find((bucket) => bucket.status === "active");
  assert.equal(active.count, 2);
});

// --- Route wiring (static, matching the established
// next/headers-route-can't-be-invoked-directly convention) ---

test("REGRESSION: app/api/marketing/overview/route.ts enforces requireMarketingAccess before deriving any data, and never accepts a client-supplied businessId", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/marketing/overview/route.ts"), "utf8");
  assert.match(source, /requireMarketingAccess\("view"\)/);
  assert.match(source, /if \(!access\.ok\) return NextResponse\.json\(\{ error: access\.error \}, \{ status: access\.status \}\);/);
  assert.match(source, /getMarketingOverview\(access\.businessId\)/);
  assert.doesNotMatch(source, /searchParams/, "the overview route must never read scoping input from query params");
  assert.doesNotMatch(source, /request\.json\(/, "GET /api/marketing/overview must never read a request body");
  assert.doesNotMatch(source, /businessId["']\]/, "must never index into a client payload for businessId");
});
