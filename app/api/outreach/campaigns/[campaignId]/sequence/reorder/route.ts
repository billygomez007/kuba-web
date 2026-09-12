import { NextResponse } from "next/server";

import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { reorderSequenceSteps } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null);
  const orderedStepIds = Array.isArray(body?.orderedStepIds) ? body.orderedStepIds.filter((id: unknown) => typeof id === "string") : null;

  if (!orderedStepIds || orderedStepIds.length === 0) {
    return NextResponse.json({ error: "orderedStepIds is required." }, { status: 400 });
  }

  try {
    await reorderSequenceSteps(access.businessId, campaignId, orderedStepIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reorder sequence steps." }, { status: 400 });
  }
}
