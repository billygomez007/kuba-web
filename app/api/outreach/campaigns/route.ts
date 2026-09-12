import { NextResponse } from "next/server";

import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { canUseCampaigns } from "@/lib/outreach/campaign-policy";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { createCampaign, listCampaigns } from "@/lib/outreach/campaign-service";

export async function GET() {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const campaigns = await listCampaigns(access.businessId);
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description : null;
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  const channel = typeof body?.channel === "string" ? body.channel : "email";

  if (!name) {
    return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  }
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required." }, { status: 400 });
  }

  const entitlements = await getBusinessEntitlements(access.businessId);
  const decision = canUseCampaigns(entitlements, channel);
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.message, code: decision.code }, { status: 403 });
  }

  try {
    const campaign = await createCampaign({ businessId: access.businessId, employeeId, name, description, channel });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create campaign." }, { status: 400 });
  }
}
