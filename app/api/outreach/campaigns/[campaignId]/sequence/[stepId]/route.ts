import { NextResponse } from "next/server";

import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { removeSequenceStep, updateSequenceStep } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string; stepId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId, stepId } = await context.params;
  const body = await request.json().catch(() => null);
  const patch: { delayHours?: number; subjectTemplate?: string | null; bodyTemplate?: string } = {};
  if (body?.delayHours !== undefined) patch.delayHours = Number(body.delayHours);
  if (body?.subjectTemplate !== undefined) patch.subjectTemplate = typeof body.subjectTemplate === "string" ? body.subjectTemplate : null;
  if (typeof body?.bodyTemplate === "string") patch.bodyTemplate = body.bodyTemplate;

  try {
    await updateSequenceStep(access.businessId, campaignId, stepId, patch);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update sequence step." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId, stepId } = await context.params;
  try {
    await removeSequenceStep(access.businessId, campaignId, stepId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove sequence step." }, { status: 400 });
  }
}
