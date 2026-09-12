import { NextResponse } from "next/server";

import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { launchCampaignNow } from "@/lib/outreach/campaign-lifecycle";
import { canUseCampaigns } from "@/lib/outreach/campaign-policy";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { getCampaignOrThrow } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;

  try {
    const campaign = await getCampaignOrThrow(access.businessId, campaignId);
    const entitlements = await getBusinessEntitlements(access.businessId);
    const decision = canUseCampaigns(entitlements, campaign.channel);
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.message, code: decision.code }, { status: 403 });
    }

    await launchCampaignNow(access.businessId, campaignId, access.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to launch campaign." }, { status: 400 });
  }
}
