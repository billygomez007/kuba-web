import { NextResponse } from "next/server";

import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { scheduleCampaign } from "@/lib/outreach/campaign-lifecycle";
import { canUseCampaigns } from "@/lib/outreach/campaign-policy";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { getCampaignOrThrow } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null);
  const scheduledAt = typeof body?.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "scheduledAt (ISO date string) is required." }, { status: 400 });
  }

  try {
    const campaign = await getCampaignOrThrow(access.businessId, campaignId);
    const entitlements = await getBusinessEntitlements(access.businessId);
    const decision = canUseCampaigns(entitlements, campaign.channel);
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.message, code: decision.code }, { status: 403 });
    }

    await scheduleCampaign(access.businessId, campaignId, access.userId, scheduledAt);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to schedule campaign." }, { status: 400 });
  }
}
