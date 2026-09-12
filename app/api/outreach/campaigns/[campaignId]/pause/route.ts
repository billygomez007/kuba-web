import { NextResponse } from "next/server";

import { pauseCampaign } from "@/lib/outreach/campaign-lifecycle";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  try {
    await pauseCampaign(access.businessId, campaignId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to pause campaign." }, { status: 400 });
  }
}
