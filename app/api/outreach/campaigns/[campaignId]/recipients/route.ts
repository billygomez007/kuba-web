import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees, leads, outreachCampaignRecipients, outreachProspects } from "@/db/schema";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { enrollRecipients } from "@/lib/outreach/recipient-enrollment";

type RouteContext = { params: Promise<{ campaignId: string }> };

// Safe, human-readable label for the handed-off lead's `intent` (see
// lib/outreach/sales-handoff.ts) — surfaces WHY a recipient was handed off
// without exposing the raw internal claim/idempotency mechanics behind it.
const HANDOFF_REASON_LABEL: Record<string, string> = {
  outreach_campaign_reply: "Replied to campaign",
  outreach_qualified_prospect: "AI-qualified via research",
};

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId } = await context.params;
  const recipients = await db
    .select({
      recipient: outreachCampaignRecipients,
      companyName: outreachProspects.companyName,
      handoffIntent: leads.intent,
      handoffEmployeeName: aiEmployees.name,
    })
    .from(outreachCampaignRecipients)
    .leftJoin(outreachProspects, eq(outreachProspects.id, outreachCampaignRecipients.prospectId))
    .leftJoin(leads, and(eq(leads.id, outreachCampaignRecipients.handoffLeadId), eq(leads.businessId, access.businessId)))
    .leftJoin(aiEmployees, and(eq(aiEmployees.id, leads.assignedEmployeeId), eq(aiEmployees.businessId, access.businessId)))
    .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.businessId, access.businessId)));

  return NextResponse.json({
    recipients: recipients.map((row) => ({
      ...row.recipient,
      companyName: row.companyName ?? null,
      handoffReasonLabel: (row.handoffIntent && HANDOFF_REASON_LABEL[row.handoffIntent]) || null,
      handoffAssignedEmployeeName: row.handoffEmployeeName ?? null,
    })),
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
