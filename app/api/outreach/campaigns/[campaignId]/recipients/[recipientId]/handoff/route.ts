import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";
import { getLatestReplySummary, handleCampaignReplyHandoff } from "@/lib/outreach/campaign-reply-handoff";

type RouteContext = { params: Promise<{ campaignId: string; recipientId: string }> };

const MAX_NEXT_ACTION_LENGTH = 500;
const DEFAULT_NEXT_ACTION = "Reach out to discuss next steps.";

/**
 * Manual Outreach -> Sales handoff (Phase 8). Deliberately requires an
 * explicit human action rather than auto-promoting every campaign reply —
 * a "not interested"/"unsubscribe" reply must never silently become a
 * Sales lead.
 *
 * Two distinct authorities are required, not one: requireCampaignAccess
 * ("manage") resolves the tenant the same way every other route under
 * app/api/outreach/campaigns/** does (see campaign-route-context.ts and
 * tests/outreach-campaign-routes-policy.test.mjs, which asserts every
 * route in this tree uses it) — but creating a Sales lead is a separate
 * authority from managing Outreach campaigns, so sales.manage is also
 * required (matching app/api/leads/[id]/route.ts's convention for every
 * other lead-mutating route). A user needs both to trigger this.
 *
 * The reply text used as evidence (getLatestReplySummary) is always read
 * from the persisted inbound message for this recipient's conversation —
 * never trusted from the request body — so the stored handoff reason
 * reflects what the customer actually sent.
 */
export async function POST(request: Request, context: RouteContext) {
  const access = await requireCampaignAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { membership } = await requireBusinessMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.SALES_MANAGE)) {
    return NextResponse.json({ error: "You do not have permission to manage leads." }, { status: 403 });
  }

  const { campaignId, recipientId } = await context.params;
  const businessId = access.businessId;

  const recipientRows = await db
    .select({ status: outreachCampaignRecipients.status })
    .from(outreachCampaignRecipients)
    .where(
      and(
        eq(outreachCampaignRecipients.id, recipientId),
        eq(outreachCampaignRecipients.campaignId, campaignId),
        eq(outreachCampaignRecipients.businessId, businessId),
      ),
    )
    .limit(1);
  if (!recipientRows[0]) {
    return NextResponse.json({ error: "Campaign recipient not found for this business/campaign." }, { status: 404 });
  }

  let recommendedNextAction = DEFAULT_NEXT_ACTION;
  try {
    const body = await request.json();
    const provided = typeof body?.recommendedNextAction === "string" ? body.recommendedNextAction.trim() : "";
    if (provided) recommendedNextAction = provided.slice(0, MAX_NEXT_ACTION_LENGTH);
  } catch {
    // No/empty body is fine — the default next-action note is used.
  }

  const replySummary = await getLatestReplySummary(businessId, recipientId);

  try {
    const result = await handleCampaignReplyHandoff({
      businessId,
      campaignId,
      recipientId,
      replySummary,
      recommendedNextAction,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, deduplicated: result.deduplicated, lead: result.lead });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to hand off to Sales." }, { status: 400 });
  }
}
