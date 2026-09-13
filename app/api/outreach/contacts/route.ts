import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachContacts, outreachProspects } from "@/db/schema";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { isSuppressed } from "@/lib/outreach/suppression";

/**
 * Read-only listing of saved Outreach contacts for the recipient-selection
 * UI (approved spec, section 6-7) — surfaces the same research context
 * (company, ICP fit, qualification) the Outreach agent already sees via
 * getOutreachProspects, joined for dashboard consumption. Optionally
 * annotated with per-contact campaign-eligibility when a campaignId is
 * given, so the UI can show why a contact can or cannot be enrolled
 * before the user tries.
 */
export async function GET(request: Request) {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const search = url.searchParams.get("search")?.trim();

  const conditions = [eq(outreachContacts.businessId, access.businessId)];
  if (search) {
    conditions.push(
      or(
        like(outreachContacts.name, `%${search}%`),
        like(outreachContacts.email, `%${search}%`),
        like(outreachProspects.companyName, `%${search}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      contactId: outreachContacts.id,
      name: outreachContacts.name,
      jobTitle: outreachContacts.jobTitle,
      email: outreachContacts.email,
      phone: outreachContacts.phone,
      contactType: outreachContacts.contactType,
      verificationStatus: outreachContacts.verificationStatus,
      doNotContact: outreachContacts.doNotContact,
      consentStatus: outreachContacts.consentStatus,
      prospectId: outreachProspects.id,
      companyName: outreachProspects.companyName,
      website: outreachProspects.website,
      industry: outreachProspects.industry,
      qualificationStatus: outreachProspects.qualificationStatus,
      icpFitScore: outreachProspects.icpFitScore,
      qualificationReason: outreachProspects.qualificationReason,
      recipientId: outreachCampaignRecipients.id,
      recipientStatus: outreachCampaignRecipients.status,
    })
    .from(outreachContacts)
    .innerJoin(outreachProspects, eq(outreachProspects.id, outreachContacts.prospectId))
    .leftJoin(
      outreachCampaignRecipients,
      campaignId
        ? and(eq(outreachCampaignRecipients.contactId, outreachContacts.id), eq(outreachCampaignRecipients.campaignId, campaignId))
        : sql`0 = 1`,
    )
    .where(and(...conditions))
    .orderBy(desc(outreachContacts.updatedAt))
    .limit(200);

  const contacts = await Promise.all(
    rows.map(async (row) => {
      const destination = row.email;
      const suppressed = destination ? await isSuppressed(access.businessId, "email", destination) : false;
      return {
        ...row,
        alreadyEnrolled: Boolean(row.recipientId),
        suppressed,
      };
    }),
  );

  return NextResponse.json({ contacts });
}
