import { NextResponse } from "next/server";

import { stopCampaign } from "@/lib/outreach/campaign-lifecycle";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";

type RouteContext = { params: Promise<{ campaignId: string }> };

/** Idempotent — calling stop on an already-stopped campaign returns success without error (section 18). */
export async function POST(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  try {
    await stopCampaign(access.businessId, campaignId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to stop campaign." }, { status: 400 });
  }
}
