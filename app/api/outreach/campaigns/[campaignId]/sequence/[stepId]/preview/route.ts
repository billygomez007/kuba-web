import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachSequenceSteps } from "@/db/schema";
import { renderTemplate, withUnsubscribeFooter } from "@/lib/outreach/email-channel";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { getCampaignOrThrow } from "@/lib/outreach/campaign-service";

type RouteContext = { params: Promise<{ campaignId: string; stepId: string }> };

/**
 * Deterministic, local recipient preview (section 10). Reuses the exact
 * same renderTemplate/withUnsubscribeFooter functions the real send path
 * (lib/outreach/process-send.ts) uses, so the preview can never drift from
 * what would actually be sent. Never calls Resend, never persists
 * anything, never marks anything as sent.
 */
export async function GET(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { campaignId, stepId } = await context.params;
  const url = new URL(request.url);
  const recipientId = url.searchParams.get("recipientId");

  try {
    await getCampaignOrThrow(access.businessId, campaignId);

    const stepRows = await db
      .select()
      .from(outreachSequenceSteps)
      .where(and(eq(outreachSequenceSteps.id, stepId), eq(outreachSequenceSteps.campaignId, campaignId), eq(outreachSequenceSteps.businessId, access.businessId)))
      .limit(1);
    const step = stepRows[0];
    if (!step) return NextResponse.json({ error: "Sequence step not found." }, { status: 404 });

    let displayName = "there";
    let destinationIdentity = "recipient@example.com";
    let recipientForFooter = "preview-recipient";

    if (recipientId) {
      const recipientRows = await db
        .select()
        .from(outreachCampaignRecipients)
        .where(
          and(
            eq(outreachCampaignRecipients.id, recipientId),
            eq(outreachCampaignRecipients.campaignId, campaignId),
            eq(outreachCampaignRecipients.businessId, access.businessId),
          ),
        )
        .limit(1);
      const recipient = recipientRows[0];
      if (!recipient) return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
      displayName = recipient.displayName || "there";
      destinationIdentity = recipient.destinationIdentity;
      recipientForFooter = recipient.id;
    }

    const variables = { displayName };
    const subject = step.subjectTemplate ? renderTemplate(step.subjectTemplate, variables) : "";
    const bodyHtml = renderTemplate(step.bodyTemplate, variables);
    const htmlWithFooter = withUnsubscribeFooter({
      html: bodyHtml,
      businessId: access.businessId,
      recipientId: recipientForFooter,
      channel: "email",
      identity: destinationIdentity,
      unsubscribeBaseUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "https://superkuba.com"}/api/outreach/unsubscribe`,
    });

    return NextResponse.json({
      from: process.env.EMAIL_FROM || null,
      to: destinationIdentity,
      subject,
      html: htmlWithFooter,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate preview." }, { status: 400 });
  }
}
