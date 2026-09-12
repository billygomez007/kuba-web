import { NextResponse } from "next/server";

import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { addSequenceStep, listSequenceSteps } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  try {
    const steps = await listSequenceSteps(access.businessId, campaignId);
    return NextResponse.json({ steps });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign not found." }, { status: 404 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null);
  const delayHours = Number(body?.delayHours ?? 0);
  const subjectTemplate = typeof body?.subjectTemplate === "string" ? body.subjectTemplate : null;
  const bodyTemplate = typeof body?.bodyTemplate === "string" ? body.bodyTemplate : "";

  try {
    const stepId = await addSequenceStep(access.businessId, campaignId, { delayHours, subjectTemplate, bodyTemplate });
    return NextResponse.json({ stepId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add sequence step." }, { status: 400 });
  }
}
