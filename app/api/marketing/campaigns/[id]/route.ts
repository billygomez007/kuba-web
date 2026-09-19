import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingCampaigns } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { getMarketingCampaignOperations } from "@/lib/marketing/campaign-operations";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { assertCampaignTransition } from "@/lib/marketing/lifecycle";
import { marketingAudienceBelongsToBusiness } from "@/lib/marketing/ownership";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMarketingAccess("view");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { id } = await params;
  const operations = await getMarketingCampaignOperations(
    access.businessId,
    id,
  );

  if (!operations) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...operations,
    capabilities: access.capabilities,
    currentUserId: access.userId,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMarketingAccess("manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const [current] = await db
    .select()
    .from(marketingCampaigns)
    .where(
      and(
        eq(marketingCampaigns.id, id),
        eq(marketingCampaigns.businessId, access.businessId),
      ),
    )
    .limit(1);

  if (!current) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  const allowed = [
    "name",
    "description",
    "objective",
    "campaignType",
    "targetAudienceId",
    "offer",
    "landingUrl",
    "timezone",
  ] as const;

  if (body && "targetAudienceId" in body && body.targetAudienceId !== null) {
    if (typeof body.targetAudienceId !== "string") {
      return NextResponse.json(
        { error: "targetAudienceId must be a string or null." },
        { status: 400 },
      );
    }

    if (
      !(await marketingAudienceBelongsToBusiness(
        access.businessId,
        body.targetAudienceId,
      ))
    ) {
      return NextResponse.json(
        { error: "Audience does not belong to this business." },
        { status: 403 },
      );
    }
  }

  if (body && "approvalStatus" in body) {
    return NextResponse.json(
      {
        error:
          "Campaign approval status is controlled by the Marketing approval workflow.",
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = Object.fromEntries(
    allowed
      .filter((key) => body && key in body)
      .map((key) => [key, body[key]]),
  );

  let statusChanged = false;

  if (body && typeof body.status === "string") {
    if (body.status === "pending_approval") {
      return NextResponse.json(
        {
          error:
            "Campaign approval must be requested through the Marketing approval workflow.",
        },
        { status: 409 },
      );
    }

    if (
      current.status === "pending_approval" &&
      body.status === "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "Campaign approval must be completed through the Marketing approval review workflow.",
        },
        { status: 409 },
      );
    }

    try {
      assertCampaignTransition(current.status, body.status);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid campaign transition.",
        },
        { status: 409 },
      );
    }

    statusChanged = current.status !== body.status;
    patch.status = body.status;
  }

  patch.updatedAt = new Date();

  await db
    .update(marketingCampaigns)
    .set(patch)
    .where(
      and(
        eq(marketingCampaigns.id, id),
        eq(marketingCampaigns.businessId, access.businessId),
      ),
    );

  if (statusChanged) {
    await createAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "marketing.campaign.status_changed",
      resource: "marketing_campaign",
      resourceId: id,
      description: "Marketing campaign status changed.",
      metadata: {
        from: current.status,
        to: body.status,
      },
    });
  }

  const operations = await getMarketingCampaignOperations(
    access.businessId,
    id,
  );

  return NextResponse.json({
    ...operations,
    capabilities: access.capabilities,
    currentUserId: access.userId,
  });
}
