import { NextResponse } from "next/server";

import { resumeCampaign } from "@/lib/outreach/campaign-lifecycle";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  try {
    await resumeCampaign(access.businessId, campaignId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resume campaign." }, { status: 400 });
  }
}
