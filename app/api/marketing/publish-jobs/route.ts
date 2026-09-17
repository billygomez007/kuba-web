import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingPublishJobs } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";
import {
  marketingCampaignBelongsToBusiness,
  marketingContentBelongsToBusiness,
  marketingSocialAccountBelongsToBusiness,
  marketingVariantBelongsToBusiness,
} from "@/lib/marketing/ownership";

export async function GET() { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); return NextResponse.json({ jobs: await db.select().from(marketingPublishJobs).where(eq(marketingPublishJobs.businessId, access.businessId)).orderBy(desc(marketingPublishJobs.updatedAt)) }); }
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); if (typeof body?.contentItemId !== "string" || typeof body?.channel !== "string") return NextResponse.json({ error: "contentItemId and channel are required." }, { status: 400 });

const content = await marketingContentBelongsToBusiness(access.businessId, body.contentItemId);
if (!content) return NextResponse.json({ error: "Content does not belong to this business." }, { status: 403 });

const campaignId = typeof body?.campaignId === "string" ? body.campaignId : null;
if (campaignId && !(await marketingCampaignBelongsToBusiness(access.businessId, campaignId))) return NextResponse.json({ error: "Campaign does not belong to this business." }, { status: 403 });
if (campaignId && content.campaignId && content.campaignId !== campaignId) return NextResponse.json({ error: "Content is not assigned to this campaign." }, { status: 409 });

const contentVariantId = typeof body?.contentVariantId === "string" ? body.contentVariantId : null;
if (contentVariantId) {
  const variant = await marketingVariantBelongsToBusiness(access.businessId, contentVariantId);
  if (!variant) return NextResponse.json({ error: "Content variant does not belong to this business." }, { status: 403 });
  if (variant.contentItemId !== body.contentItemId) return NextResponse.json({ error: "Content variant does not belong to this content item." }, { status: 409 });
}

const socialAccountId = typeof body?.socialAccountId === "string" ? body.socialAccountId : null;
if (socialAccountId && !(await marketingSocialAccountBelongsToBusiness(access.businessId, socialAccountId))) return NextResponse.json({ error: "Social account does not belong to this business." }, { status: 403 });

const now = new Date(); const job = { id: randomUUID(), businessId: access.businessId, campaignId, contentItemId: body.contentItemId, contentVariantId, socialAccountId, channel: body.channel, scheduledAt: body?.scheduledAt ? new Date(body.scheduledAt) : null, status: body?.scheduledAt ? "scheduled" : "queued", attemptCount: 0, idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : randomUUID(), providerPostId: null, publishedAt: null, failedAt: null, failureCode: "PUBLISHING_ADAPTER_UNAVAILABLE", failureMessageSafe: "This channel is not connected to a publishing provider.", metadata: null, createdAt: now, updatedAt: now }; await db.insert(marketingPublishJobs).values(job); return NextResponse.json({ job, execution: "blocked", code: "PUBLISHING_ADAPTER_UNAVAILABLE" }, { status: 201 }); }
