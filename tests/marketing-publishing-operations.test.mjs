import { register } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { eq, sql } from "drizzle-orm";

register(new URL("./helpers/alias-loader.mjs", import.meta.url));
register(new URL("./helpers/marketing-session-loader.mjs", import.meta.url));
let tempDir, db, s, publishing, approvals, review, calendar, social, operations, policy;
const now = new Date("2026-09-17T12:00:00Z");
const at = new Date("2026-10-12T12:00:00Z");
function session(role = "manager", userId = "reviewer", businessId = "a", permissions = null) {
  globalThis.__marketingTestSession = { user: { id: userId }, membership: { businessId, role, permissions }, error: null };
}
const request = (body, method = "POST") => new Request("http://localhost/api/marketing?businessId=b", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const publish = (body = {}) => publishing.POST(request({ contentItemId: "content-a", channel: "instagram", ...body }));
const decide = (id, body = { status: "approved" }) => review.PATCH(request(body, "PATCH"), { params: Promise.resolve({ id }) });
const rows = table => db.select().from(table);
async function seedApproval(id, extra = {}) {
  await db.insert(s.marketingApprovals).values({ id, businessId: "a", resourceType: "content", resourceId: "pending-a", status: "pending", requestedByUserId: "author", createdAt: now, updatedAt: now, ...extra });
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-6a4d-"));
  const url = `file:${path.join(tempDir, "database.db")}`;
  execFileSync(process.execPath, ["scripts/bootstrap-clean-database.mjs"], { env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: url, CLEAN_BOOTSTRAP_KEEP: "1" }, stdio: "pipe" });
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = "";
  ({ db } = await import("@/db")); s = await import("@/db/schema");
  publishing = await import("@/app/api/marketing/publish-jobs/route");
  approvals = await import("@/app/api/marketing/approvals/route");
  review = await import("@/app/api/marketing/approvals/[id]/route");
  calendar = await import("@/app/api/marketing/calendar/route");
  social = await import("@/app/api/marketing/social-accounts/route");
  operations = await import("@/lib/marketing/publishing-operations");
  policy = await import("@/lib/marketing/publishing-policy");
  await db.insert(s.users).values(["author", "reviewer", "outsider"].map(id => ({ id, name: id === "outsider" ? "TENANT B SECRET" : id, email: `${id}@example.test`, createdAt: now, updatedAt: now })));
  await db.insert(s.businessUsers).values(["author", "reviewer", "outsider"].map(id => ({ id, userId: id, businessId: id === "outsider" ? "b" : "a", role: "manager", createdAt: now })));
  await db.insert(s.marketingCampaigns).values(["a", "other", "b"].map(id => ({ id: `campaign-${id}`, businessId: id === "b" ? "b" : "a", name: id === "b" ? "TENANT B SECRET" : `Campaign ${id}`, objective: "awareness", campaignType: "organic", status: "pending_approval", approvalStatus: "pending", createdAt: now, updatedAt: now })));
  await db.insert(s.marketingContentItems).values(["a", "other", "pending-a", "b", "standalone"].map(id => ({ id: id === "pending-a" ? id : `content-${id}`, businessId: id === "b" ? "b" : "a", campaignId: id === "standalone" ? null : `campaign-${id === "b" ? "b" : "a"}`, title: id === "b" ? "TENANT B SECRET" : `Content ${id}`, contentType: "post", status: "draft", approvalStatus: id === "pending-a" ? "pending" : "approved", createdAt: now, updatedAt: now })));
  await db.insert(s.marketingContentVariants).values([
    ["variant-a", "a", "content-a", "instagram"], ["variant-other", "a", "content-other", "instagram"], ["variant-channel", "a", "content-a", "facebook"], ["variant-b", "b", "content-b", "instagram"], ["variant-alone", "a", "content-standalone", "website"],
  ].map(([id, businessId, contentItemId, channel]) => ({ id, businessId, contentItemId, channel, text: businessId === "b" ? "TENANT B SECRET" : "Persisted content", scheduledAt: at, status: "scheduled", createdAt: now, updatedAt: now })));
  await db.insert(s.marketingSocialAccounts).values([
    ["account-a", "a", "instagram", "connected"], ["account-b", "b", "instagram", "connected"], ["account-facebook", "a", "facebook", "connected"], ["account-expired", "a", "instagram", "connected"], ["account-disabled", "a", "x", "disabled"], ["account-attention", "a", "youtube", "needs_attention"],
  ].map(([id, businessId, provider, status]) => ({ id, businessId, provider, status, displayName: businessId === "b" ? "TENANT B SECRET" : id, metadata: "PRIVATE CONNECTION METADATA", externalAccountId: `private-${id}`, connectedAt: now, expiresAt: id === "account-expired" ? new Date("2020-01-01") : null, createdAt: now, updatedAt: now })));
  await seedApproval("approval-a");
  await seedApproval("approval-b", { businessId: "b", resourceId: "content-b", requestedByUserId: "outsider" });
  await seedApproval("approval-history", { status: "rejected", reviewedByUserId: "reviewer", reviewedAt: now, comment: "Revise the copy" });
  await seedApproval("approval-bad-reference", { resourceId: "content-b", requestedByUserId: "outsider", reviewedByUserId: "outsider" });
});
test.beforeEach(() => session());
test.after(async () => { delete globalThis.__marketingTestSession; await rm(tempDir, { recursive: true, force: true }); });

for (const approvalStatus of ["draft", "pending", "rejected", "changes_requested"]) {
  test(`publishing gate rejects ${approvalStatus} content without writes`, async () => {
    await db.update(s.marketingContentItems).set({ approvalStatus }).where(eq(s.marketingContentItems.id, "pending-a"));
    const before = (await rows(s.marketingPublishJobs)).length;
    assert.equal((await publish({ contentItemId: "pending-a" })).status, 409);
    assert.equal((await rows(s.marketingPublishJobs)).length, before);
  });
}
for (const [name, body, status] of [
  ["unsupported channel", { channel: "invented" }, 400],
  ["empty channel", { channel: "" }, 400],
  ["foreign content", { contentItemId: "content-b" }, 403],
  ["foreign campaign", { campaignId: "campaign-b" }, 403],
  ["unrelated campaign", { campaignId: "campaign-other" }, 409],
  ["standalone campaign assignment", { contentItemId: "content-standalone", campaignId: "campaign-a" }, 409],
  ["foreign variant", { contentVariantId: "variant-b" }, 403],
  ["wrong variant content", { contentVariantId: "variant-other" }, 409],
  ["wrong variant channel", { contentVariantId: "variant-channel" }, 409],
  ["foreign account", { socialAccountId: "account-b" }, 403],
  ["wrong account provider", { socialAccountId: "account-facebook" }, 409],
  ["missing account", { socialAccountId: "missing" }, 403],
  ["non-string variant", { contentVariantId: 12 }, 400],
  ["empty idempotency key", { idempotencyKey: " " }, 400],
]) test(`publishing validates ${name}`, async () => {
  const before = (await rows(s.marketingPublishJobs)).length;
  assert.equal((await publish(body)).status, status);
  assert.equal((await rows(s.marketingPublishJobs)).length, before);
});
for (const scheduledAt of ["", "bad", "2026-02-30", "2026-09-17T24:00:00Z", "2026-09-17T12:60:00Z", "2026-09-17T12:00:00", "2026-13-01", 0, {}, "2026-09-17T12:00:00+25:00"]) {
  test(`invalid scheduledAt rejected: ${JSON.stringify(scheduledAt)}`, async () => assert.equal((await publish({ scheduledAt })).status, 400));
}
test("date policy accepts leap days and explicit timezone offsets", () => {
  assert.equal(policy.parseMarketingDate("2024-02-29").toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(policy.parseMarketingDate("2026-09-17T12:30:00+02:00").toISOString(), "2026-09-17T10:30:00.000Z");
  assert.equal(policy.parseMarketingDate("2025-02-29"), null);
});
test("malformed request JSON fails safely", async () => {
  assert.equal((await publishing.POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
});
test("approved scheduling persists truthful provider state and authenticated business/actor audit", async () => {
  const response = await publish({ contentVariantId: "variant-a", socialAccountId: "account-a", scheduledAt: at.toISOString(), idempotencyKey: "scheduled-a", businessId: "b", userId: "outsider", status: "published", providerPostId: "fake", publishedAt: at.toISOString(), attemptCount: 99 });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.execution, "blocked"); assert.equal(body.code, "PUBLISHING_ADAPTER_UNAVAILABLE");
  const job = (await rows(s.marketingPublishJobs)).find(row => row.id === body.job.id);
  assert.equal(job.businessId, "a"); assert.equal(job.campaignId, "campaign-a"); assert.equal(job.status, "scheduled");
  assert.equal(job.providerPostId, null); assert.equal(job.publishedAt, null); assert.equal(job.failedAt, null); assert.equal(job.attemptCount, 0); assert.equal(job.failureCode, body.code);
  const audit = (await rows(s.auditLogs)).find(row => row.resourceId === job.id);
  assert.equal(audit.businessId, "a"); assert.equal(audit.userId, "reviewer"); assert.equal(audit.action, "marketing.publish_job.scheduled");
});
test("queued jobs have no provider success or retry attempt", async () => {
  const response = await publish(); assert.equal(response.status, 201);
  const { job } = await response.json();
  assert.equal(job.status, "queued"); assert.equal(job.scheduledAt, null); assert.equal(job.providerPostId, null); assert.equal(job.publishedAt, null); assert.equal(job.attemptCount, 0);
});
test("duplicate idempotency key is a conflict and creates neither second job nor audit", async () => {
  const before = (await rows(s.auditLogs)).length;
  const response = await publish({ idempotencyKey: "scheduled-a" });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, "DUPLICATE_IDEMPOTENCY_KEY");
  assert.equal((await rows(s.marketingPublishJobs)).filter(row => row.idempotencyKey === "scheduled-a").length, 1);
  assert.equal((await rows(s.auditLogs)).length, before);
});
test("idempotency is scoped to the authenticated business", async () => {
  session("manager", "outsider", "b");
  assert.equal((await publish({ contentItemId: "content-b", idempotencyKey: "scheduled-a", scheduledAt: at.toISOString() })).status, 201);
});
test("publish transaction rolls back the job if audit persistence fails", async () => {
  await db.run(sql.raw("CREATE TRIGGER fail_publish_audit BEFORE INSERT ON audit_logs WHEN NEW.action = 'marketing.publish_job.created' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END"));
  try { await assert.rejects(publish({ idempotencyKey: "rollback" })); }
  finally { await db.run(sql.raw("DROP TRIGGER fail_publish_audit")); }
  assert.equal((await rows(s.marketingPublishJobs)).some(row => row.idempotencyKey === "rollback"), false);
});
test("approval and relationships are read inside the publishing transaction", async () => {
  const original = db.transaction.bind(db);
  db.transaction = async callback => {
    await db.update(s.marketingContentItems).set({ approvalStatus: "pending" }).where(eq(s.marketingContentItems.id, "content-a"));
    return original(callback);
  };
  try { assert.equal((await publish()).status, 409); }
  finally { db.transaction = original; await db.update(s.marketingContentItems).set({ approvalStatus: "approved" }).where(eq(s.marketingContentItems.id, "content-a")); }
});

for (const [name, sessionValue, expected] of [
  ["anonymous", { user: null, membership: null }, 401],
  ["no membership", { user: { id: "reviewer" }, membership: null }, 403],
  ["no Marketing view", { user: { id: "reviewer" }, membership: { businessId: "a", role: "member", permissions: "[]" } }, 403],
]) test(`all operations reject ${name}`, async () => {
  globalThis.__marketingTestSession = sessionValue;
  for (const result of [await publishing.GET(), await approvals.GET(), await calendar.GET(new Request("http://localhost")), await social.GET(), await publish(), await decide("approval-a")]) assert.equal(result.status, expected);
});
test("sales can view but cannot manage or review approvals", async () => {
  session("sales");
  assert.equal((await publishing.GET()).status, 200);
  const result = await approvals.GET(); assert.equal(result.status, 200);
  const body = await result.json(); assert.equal(body.capabilities.canManage, false); assert.equal(body.capabilities.canReviewApprovals, false);
  assert.equal((await publish()).status, 403); assert.equal((await decide("approval-a")).status, 403);
});
test("custom manage permission does not grant approval review authority", async () => {
  session("member", "reviewer", "a", JSON.stringify(["marketing.view", "marketing.manage"]));
  assert.equal((await decide("approval-a")).status, 403);
});
test("Approval Center returns pending and resolved records with real tenant-scoped identities", async () => {
  const { approvals: records, currentUserId } = await (await approvals.GET()).json();
  assert.equal(currentUserId, "reviewer"); assert.ok(records.some(row => row.status === "pending")); assert.ok(records.some(row => row.status === "rejected"));
  assert.equal(records.find(row => row.id === "approval-history").reviewerName, "reviewer");
  assert.equal(records.find(row => row.id === "approval-a").requesterName, "author");
  const bad = records.find(row => row.id === "approval-bad-reference");
  assert.equal(bad.resourceName, null); assert.equal(bad.resourceHref, null); assert.equal(bad.requesterName, null); assert.equal(bad.reviewerName, null);
  assert.doesNotMatch(JSON.stringify(records), /TENANT B SECRET|approval-b"/);
});
test("self-review is prohibited for every decision", async () => {
  session("manager", "author");
  for (const status of ["approved", "rejected", "changes_requested"]) assert.equal((await decide("approval-a", { status })).status, 403);
  assert.equal((await rows(s.marketingApprovals)).find(row => row.id === "approval-a").status, "pending");
});
test("foreign approval cannot be reviewed", async () => assert.equal((await decide("approval-b")).status, 404));
test("foreign approval resource causes complete transaction rollback", async () => {
  assert.equal((await decide("approval-bad-reference")).status, 404);
  assert.equal((await rows(s.marketingApprovals)).find(row => row.id === "approval-bad-reference").status, "pending");
  assert.equal((await rows(s.marketingContentItems)).find(row => row.id === "content-b").approvalStatus, "approved");
});
test("unsupported decision is rejected", async () => assert.equal((await decide("approval-a", { status: "published" })).status, 400));
for (const status of ["approved", "rejected", "changes_requested"]) test(`review ${status} persists actor, decision, comment, resource status and audit`, async () => {
  const id = `decision-${status}`; await seedApproval(id);
  const response = await decide(id, { status, comment: "  Recorded review  ", reviewedByUserId: "outsider", businessId: "b" });
  assert.equal(response.status, 200); const { approval } = await response.json();
  assert.equal(approval.reviewedByUserId, "reviewer"); assert.equal(approval.status, status); assert.equal(approval.comment, "Recorded review"); assert.ok(approval.reviewedAt);
  assert.equal((await rows(s.marketingContentItems)).find(row => row.id === "pending-a").approvalStatus, status);
  assert.ok((await rows(s.auditLogs)).some(row => row.businessId === "a" && row.userId === "reviewer" && row.action === "marketing.content.approval_reviewed" && JSON.parse(row.metadata).approvalId === id));
  assert.equal((await decide(id, { status: status === "approved" ? "rejected" : "approved" })).status, 409);
});
test("pending compare-and-set protects a decision resolved after initial read", async () => {
  await seedApproval("cas"); const original = db.transaction.bind(db);
  db.transaction = async callback => {
    await db.update(s.marketingApprovals).set({ status: "rejected", reviewedByUserId: "author" }).where(eq(s.marketingApprovals.id, "cas"));
    return original(callback);
  };
  try { assert.equal((await decide("cas")).status, 409); } finally { db.transaction = original; }
  assert.equal((await rows(s.marketingApprovals)).find(row => row.id === "cas").status, "rejected");
  assert.equal((await rows(s.auditLogs)).some(row => row.metadata?.includes('"approvalId":"cas"')), false);
});
test("campaign review preserves lifecycle and audit authority", async () => {
  await seedApproval("campaign-review", { resourceType: "campaign", resourceId: "campaign-a" });
  assert.equal((await decide("campaign-review")).status, 200);
  assert.equal((await rows(s.marketingCampaigns)).find(row => row.id === "campaign-a").status, "approved");
  assert.ok((await rows(s.auditLogs)).some(row => row.action === "marketing.campaign.approval_reviewed"));
});

for (const query of ["from=nope", "from=2026-02-30", "to=", "from=2026-10-13&to=2026-10-12", "to=2026-09-17T24:00:00Z", "from=2026-09-17T10:00:00"]) test(`calendar rejects invalid range ${query}`, async () => {
  assert.equal((await calendar.GET(new Request(`http://localhost?${query}`))).status, 400);
});
test("calendar includes whole end day, deduplicates canonical units, retains API collections and isolates tenants", async () => {
  const response = await calendar.GET(new Request("http://localhost?from=2026-10-12&to=2026-10-12&businessId=b"));
  assert.equal(response.status, 200); const body = await response.json();
  assert.ok(Array.isArray(body.variants)); assert.ok(Array.isArray(body.jobs));
  assert.equal(body.entries.filter(row => row.contentItemId === "content-a" && row.channel === "instagram").length, 1);
  assert.ok(body.entries.some(row => row.unitId === "variant:variant-alone"));
  assert.doesNotMatch(JSON.stringify(body), /TENANT B SECRET|variant-b|content-b/);
  assert.equal(body.to, "2026-10-12T23:59:59.999Z");
});
test("calendar deduplicates before filtering a rescheduled job outside the range", async () => {
  await db.update(s.marketingPublishJobs).set({ scheduledAt: new Date("2026-11-01T12:00:00Z") }).where(eq(s.marketingPublishJobs.idempotencyKey, "scheduled-a"));
  const result = await operations.getMarketingCalendar("a", new Date("2026-10-12"), new Date("2026-10-13"));
  assert.equal(result.entries.some(row => row.unitId === "variant:variant-a"), false);
  assert.equal(result.entries.some(row => row.kind === "publish_job"), false);
});
test("calendar output equals the canonical mergeScheduledUnits rule", async () => {
  const { mergeScheduledUnits } = await import("@/lib/marketing/overview");
  const variants = (await rows(s.marketingContentVariants)).filter(row => row.businessId === "a" && row.scheduledAt);
  const jobs = (await rows(s.marketingPublishJobs)).filter(row => row.businessId === "a" && row.scheduledAt);
  const actual = await operations.getMarketingCalendar("a", new Date(0), new Date("2100-01-01"));
  assert.deepEqual(actual.entries.map(row => row.unitId).sort(), mergeScheduledUnits(variants, jobs).map(row => row.unitId).sort());
});
test("readiness exposes only persisted tenant accounts, expiration and blocked execution without private metadata", async () => {
  const { accounts, readiness } = await (await social.GET()).json();
  assert.equal(accounts.length, 5);
  assert.doesNotMatch(JSON.stringify({ accounts, readiness }), /TENANT B SECRET|PRIVATE CONNECTION METADATA|externalAccountId/);
  const instagram = readiness.find(row => row.provider === "instagram");
  assert.equal(instagram.accounts.find(row => row.id === "account-a").readinessState, "connected");
  assert.equal(instagram.accounts.find(row => row.id === "account-expired").readinessState, "expired");
  assert.equal(readiness.find(row => row.provider === "x").accounts[0].readinessState, "disabled");
  assert.equal(readiness.find(row => row.provider === "youtube").accounts[0].readinessState, "needs_attention");
  assert.deepEqual(readiness.find(row => row.provider === "telegram").accounts, []);
  assert.ok(readiness.every(row => row.execution === "blocked" && row.code === "PUBLISHING_ADAPTER_UNAVAILABLE"));
});
test("provider connection endpoint reports unavailable without creating identities or accounts", async () => {
  const before = (await rows(s.marketingSocialAccounts)).length;
  const response = await social.POST(request({ provider: "instagram", businessId: "b" }));
  assert.equal(response.status, 409); assert.equal((await response.json()).code, "PROVIDER_NOT_CONNECTED");
  assert.equal((await rows(s.marketingSocialAccounts)).length, before);
});
test("publishing read model resolves tenant resources while preserving provider truth", async () => {
  const { jobs } = await (await publishing.GET()).json();
  assert.doesNotMatch(JSON.stringify(jobs), /TENANT B SECRET|PRIVATE CONNECTION METADATA|externalAccountId/);
  const job = jobs.find(row => row.idempotencyKey === "scheduled-a");
  assert.equal(job.content.title, "Content a"); assert.equal(job.variant.id, "variant-a"); assert.equal(job.socialAccount.id, "account-a");
  assert.equal(job.providerPostId, null); assert.equal(job.publishedAt, null); assert.equal(job.failureCode, "PUBLISHING_ADAPTER_UNAVAILABLE");
});
test("empty business read models invent no operations or account identities", async () => {
  assert.deepEqual(await operations.getMarketingApprovalCenter("empty"), []);
  assert.deepEqual(await operations.getMarketingPublishingOperations("empty"), []);
  assert.deepEqual((await operations.getMarketingCalendar("empty", new Date(0), new Date("2100-01-01"))).entries, []);
  assert.ok(operations.marketingChannelReadiness(await operations.getMarketingChannelAccounts("empty")).every(row => row.accounts.length === 0));
});
test("Approval Center controls use server capabilities, self-review and pending status", async () => {
  const source = await readFile("app/dashboard/marketing/approvals/page.tsx", "utf8");
  assert.match(source, /data\.capabilities\.canReviewApprovals/); assert.match(source, /row\.requestedByUserId !== data\.currentUserId/); assert.match(source, /row\.status === "pending"/); assert.match(source, /Resolved history/);
  assert.match(source, /method: "PATCH"/); assert.doesNotMatch(source, /localStorage|fake|mock/);
});
