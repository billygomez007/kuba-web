import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachProspects } from "@/db/schema";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { enrollRecipients } from "@/lib/outreach/recipient-enrollment";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const recipients = await db
    .select({
      recipient: outreachCampaignRecipients,
      companyName: outreachProspects.companyName,
    })
    .from(outreachCampaignRecipients)
    .leftJoin(outreachProspects, eq(outreachProspects.id, outreachCampaignRecipients.prospectId))
    .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.businessId, access.businessId)));

  return NextResponse.json({
    recipients: recipients.map((row) => ({ ...row.recipient, companyName: row.companyName ?? null })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null);
  const contactIds = Array.isArray(body?.contactIds) ? body.contactIds.filter((id: unknown) => typeof id === "string") : null;

  if (!contactIds || contactIds.length === 0) {
    return NextResponse.json({ error: "contactIds is required." }, { status: 400 });
  }

  try {
    const results = await enrollRecipients(access.businessId, campaignId, contactIds);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to enroll recipients." }, { status: 400 });
  }
}
