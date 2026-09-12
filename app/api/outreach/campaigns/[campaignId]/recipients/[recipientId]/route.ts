import { NextResponse } from "next/server";

import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { removeRecipientBeforeLaunch } from "@/lib/outreach/recipient-enrollment";

type RouteContext = { params: Promise<{ campaignId: string; recipientId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId, recipientId } = await context.params;
  try {
    await removeRecipientBeforeLaunch(access.businessId, campaignId, recipientId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove recipient." }, { status: 400 });
  }
}
