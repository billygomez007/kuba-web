import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { getCampaignMetrics } from "@/lib/outreach/campaign-metrics";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { deleteDraftCampaign, getCampaignOrThrow, updateCampaignFields } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  try {
    const campaign = await getCampaignOrThrow(access.businessId, campaignId);
    const metrics = await getCampaignMetrics(access.businessId, campaignId);
    const employeeRows = await db.select({ name: aiEmployees.name }).from(aiEmployees).where(eq(aiEmployees.id, campaign.employeeId)).limit(1);
    return NextResponse.json({ campaign: { ...campaign, employeeName: employeeRows[0]?.name ?? null }, metrics });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null);
  const patch: { name?: string; description?: string | null } = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if (body?.description !== undefined) patch.description = typeof body.description === "string" ? body.description : null;

  try {
    const campaign = await updateCampaignFields(access.businessId, campaignId, patch);
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update campaign." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  try {
    await deleteDraftCampaign(access.businessId, campaignId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete campaign." }, { status: 400 });
  }
}
