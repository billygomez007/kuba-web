import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { auditLogs, marketingPublishJobs } from "@/db/schema";
import { MARKETING_CHANNELS, requireMarketingAccess } from "@/lib/marketing/context";
import { getMarketingPublishingOperations } from "@/lib/marketing/publishing-operations";
import { parseMarketingDate } from "@/lib/marketing/publishing-policy";
import {
  marketingCampaignBelongsToBusiness,
  marketingContentBelongsToBusiness,
  marketingSocialAccountBelongsToBusiness,
  marketingVariantBelongsToBusiness,
} from "@/lib/marketing/ownership";

export async function GET() {
  const access = await requireMarketingAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ jobs: await getMarketingPublishingOperations(access.businessId) });
}

export async function POST(request: Request) {
  const access = await requireMarketingAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => null);
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  if (typeof body?.contentItemId !== "string" || !body.contentItemId || typeof body?.channel !== "string") return fail("contentItemId and channel are required.");
  if (!(MARKETING_CHANNELS as readonly string[]).includes(body.channel)) return fail("Unsupported channel.");
  for (const key of ["campaignId", "contentVariantId", "socialAccountId", "idempotencyKey"]) {
    if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== "string" || !body[key].trim())) return fail(`${key} must be a non-empty string.`);
  }
  const scheduledAt = body.scheduledAt === undefined || body.scheduledAt === null ? null : parseMarketingDate(body.scheduledAt);
  if (body.scheduledAt !== undefined && body.scheduledAt !== null && !scheduledAt) return fail("Invalid scheduledAt. Use an ISO date or timestamp with timezone.");

  // Validate relationships and approval in the same write transaction as the job and audit.
  return db.transaction(async (tx) => {
    const content = await marketingContentBelongsToBusiness(access.businessId, body.contentItemId, tx);
    if (!content) return fail("Content does not belong to this business.", 403);
    if (content.approvalStatus !== "approved") return fail("Content must be approved before creating a publish job.", 409);
    const campaignId = body.campaignId ?? content.campaignId ?? null;
    if (campaignId && !(await marketingCampaignBelongsToBusiness(access.businessId, campaignId, tx))) return fail("Campaign does not belong to this business.", 403);
    if (campaignId && content.campaignId !== campaignId) return fail("Content is not assigned to this campaign.", 409);

    const contentVariantId = body.contentVariantId ?? null;
    if (contentVariantId) {
      const variant = await marketingVariantBelongsToBusiness(access.businessId, contentVariantId, tx);
      if (!variant) return fail("Content variant does not belong to this business.", 403);
      if (variant.contentItemId !== body.contentItemId) return fail("Content variant does not belong to this content item.", 409);
      if (variant.channel !== body.channel) return fail("Content variant channel does not match the requested channel.", 409);
    }
    const socialAccountId = body.socialAccountId ?? null;
    if (socialAccountId) {
      const account = await marketingSocialAccountBelongsToBusiness(access.businessId, socialAccountId, tx);
      if (!account) return fail("Social account does not belong to this business.", 403);
      if (account.provider !== body.channel) return fail("Social account provider does not match the requested channel.", 409);
    }

    const now = new Date();
    // Preserve scheduling intent; no worker/adapter exists to execute this job.
    const job = {
      id: randomUUID(), businessId: access.businessId, campaignId,
      contentItemId: body.contentItemId, contentVariantId, socialAccountId,
      channel: body.channel, scheduledAt, status: scheduledAt ? "scheduled" : "queued",
      attemptCount: 0, idempotencyKey: body.idempotencyKey ?? randomUUID(),
      providerPostId: null, publishedAt: null, failedAt: null,
      failureCode: "PUBLISHING_ADAPTER_UNAVAILABLE",
      failureMessageSafe: "This channel is not connected to a publishing provider.",
      metadata: null, createdAt: now, updatedAt: now,
    };
    const inserted = await tx.insert(marketingPublishJobs).values(job).onConflictDoNothing({
      target: [marketingPublishJobs.businessId, marketingPublishJobs.idempotencyKey],
    }).returning({ id: marketingPublishJobs.id });
    if (!inserted.length) return NextResponse.json({ error: "A publish job with this idempotency key already exists.", code: "DUPLICATE_IDEMPOTENCY_KEY" }, { status: 409 });
    await tx.insert(auditLogs).values({
      id: randomUUID(), businessId: access.businessId, userId: access.userId,
      action: scheduledAt ? "marketing.publish_job.scheduled" : "marketing.publish_job.created",
      resource: "marketing_publish_job", resourceId: job.id,
      description: scheduledAt ? "Marketing publish job scheduled; provider execution unavailable." : "Marketing publish job queued; provider execution unavailable.",
      metadata: JSON.stringify({ contentItemId: content.id, channel: job.channel, scheduledAt, execution: "blocked" }),
      createdAt: now,
    });
    return NextResponse.json({ job, execution: "blocked", code: "PUBLISHING_ADAPTER_UNAVAILABLE" }, { status: 201 });
  });
}
