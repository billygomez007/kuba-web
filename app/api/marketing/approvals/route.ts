import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  marketingApprovals,
  marketingCampaigns,
  marketingContentItems,
} from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { requireMarketingAccess } from "@/lib/marketing/context";
import {
  marketingCampaignBelongsToBusiness,
  marketingContentBelongsToBusiness,
} from "@/lib/marketing/ownership";

export async function GET() {
  const access = await requireMarketingAccess("view");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const approvals = await db
    .select()
    .from(marketingApprovals)
    .where(eq(marketingApprovals.businessId, access.businessId))
    .orderBy(desc(marketingApprovals.updatedAt));

  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  const access = await requireMarketingAccess("manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);

  if (
    typeof body?.resourceType !== "string" ||
    typeof body?.resourceId !== "string"
  ) {
    return NextResponse.json(
      { error: "resourceType and resourceId are required." },
      { status: 400 },
    );
  }

  if (!["campaign", "content"].includes(body.resourceType)) {
    return NextResponse.json(
      { error: "Unsupported approval resource type." },
      { status: 400 },
    );
  }

  const resourceBelongsToBusiness =
    body.resourceType === "campaign"
      ? await marketingCampaignBelongsToBusiness(
          access.businessId,
          body.resourceId,
        )
      : Boolean(
          await marketingContentBelongsToBusiness(
            access.businessId,
            body.resourceId,
          ),
        );

  if (!resourceBelongsToBusiness) {
    return NextResponse.json(
      { error: "Approval resource does not belong to this business." },
      { status: 403 },
    );
  }

  const [pendingApproval] = await db
    .select({ id: marketingApprovals.id })
    .from(marketingApprovals)
    .where(
      and(
        eq(marketingApprovals.businessId, access.businessId),
        eq(marketingApprovals.resourceType, body.resourceType),
        eq(marketingApprovals.resourceId, body.resourceId),
        eq(marketingApprovals.status, "pending"),
      ),
    )
    .limit(1);

  if (pendingApproval) {
    return NextResponse.json(
      { error: "A pending approval request already exists." },
      { status: 409 },
    );
  }

  const now = new Date();

  const approval = {
    id: randomUUID(),
    businessId: access.businessId,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    status: "pending",
    requestedByUserId: access.userId,
    requestedByEmployeeId: null,
    reviewedByUserId: null,
    reviewedAt: null,
    comment: null,
    createdAt: now,
    updatedAt: now,
  };

  if (body.resourceType === "campaign") {
    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(
        and(
          eq(marketingCampaigns.id, body.resourceId),
          eq(marketingCampaigns.businessId, access.businessId),
        ),
      )
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    }

    if (!["draft", "planned"].includes(campaign.status)) {
      return NextResponse.json(
        {
          error:
            "Only draft or planned campaigns can be submitted for approval.",
        },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await tx.insert(marketingApprovals).values(approval);

      await tx
        .update(marketingCampaigns)
        .set({
          status: "pending_approval",
          approvalStatus: "pending",
          updatedAt: now,
        })
        .where(
          and(
            eq(marketingCampaigns.id, campaign.id),
            eq(marketingCampaigns.businessId, access.businessId),
          ),
        );
    });

    await createAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "marketing.campaign.approval_requested",
      resource: "marketing_campaign",
      resourceId: campaign.id,
      description: "Marketing campaign submitted for approval.",
      metadata: {
        approvalId: approval.id,
        from: campaign.status,
        to: "pending_approval",
      },
    });
  } else {
    const [content] = await db
      .select()
      .from(marketingContentItems)
      .where(
        and(
          eq(marketingContentItems.id, body.resourceId),
          eq(marketingContentItems.businessId, access.businessId),
        ),
      )
      .limit(1);

    if (!content) {
      return NextResponse.json(
        { error: "Content not found." },
        { status: 404 },
      );
    }

    await db.transaction(async (tx) => {
      await tx.insert(marketingApprovals).values(approval);

      await tx
        .update(marketingContentItems)
        .set({
          approvalStatus: "pending",
          updatedAt: now,
        })
        .where(
          and(
            eq(marketingContentItems.id, content.id),
            eq(marketingContentItems.businessId, access.businessId),
          ),
        );
    });

    await createAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "marketing.content.approval_requested",
      resource: "marketing_content",
      resourceId: content.id,
      description: "Marketing content submitted for approval.",
      metadata: {
        approvalId: approval.id,
      },
    });
  }

  return NextResponse.json(
    { approval },
    { status: 201 },
  );
}
