import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  marketingApprovals,
  marketingCampaigns,
  marketingContentItems,
} from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { requireMarketingAccess } from "@/lib/marketing/context";

const REVIEW_STATUSES = [
  "approved",
  "rejected",
  "changes_requested",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMarketingAccess("review");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const [existing] = await db
    .select()
    .from(marketingApprovals)
    .where(
      and(
        eq(marketingApprovals.id, id),
        eq(marketingApprovals.businessId, access.businessId),
      ),
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Approval not found." },
      { status: 404 },
    );
  }

  if (existing.requestedByUserId === access.userId) {
    return NextResponse.json(
      { error: "Self-approval is not permitted." },
      { status: 403 },
    );
  }

  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: "This approval has already been reviewed." },
      { status: 409 },
    );
  }

  const status = body?.status;

  if (
    typeof status !== "string" ||
    !REVIEW_STATUSES.includes(
      status as (typeof REVIEW_STATUSES)[number],
    )
  ) {
    return NextResponse.json(
      { error: "Unsupported approval status." },
      { status: 400 },
    );
  }

  const now = new Date();
  const comment =
    typeof body?.comment === "string" && body.comment.trim()
      ? body.comment.trim()
      : null;

  const result = await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(marketingApprovals)
      .set({
        status,
        reviewedByUserId: access.userId,
        reviewedAt: now,
        comment,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingApprovals.id, id),
          eq(marketingApprovals.businessId, access.businessId),
          eq(marketingApprovals.status, "pending"),
        ),
      );

    if (updateResult.rowsAffected === 0) {
      return { ok: false as const };
    }

    if (existing.resourceType === "campaign") {
      const [campaign] = await tx
        .select()
        .from(marketingCampaigns)
        .where(
          and(
            eq(marketingCampaigns.id, existing.resourceId),
            eq(marketingCampaigns.businessId, access.businessId),
          ),
        )
        .limit(1);

      if (!campaign) {
        throw new Error("APPROVAL_CAMPAIGN_NOT_FOUND");
      }

      if (campaign.status !== "pending_approval") {
        throw new Error("CAMPAIGN_NOT_PENDING_APPROVAL");
      }

      const nextCampaignStatus =
        status === "approved" ? "approved" : "draft";

      await tx
        .update(marketingCampaigns)
        .set({
          status: nextCampaignStatus,
          approvalStatus: status,
          updatedAt: now,
        })
        .where(
          and(
            eq(marketingCampaigns.id, campaign.id),
            eq(marketingCampaigns.businessId, access.businessId),
          ),
        );

      return {
        ok: true as const,
        resourceType: "campaign" as const,
        resourceId: campaign.id,
        from: campaign.status,
        to: nextCampaignStatus,
      };
    }

    if (existing.resourceType === "content") {
      const [content] = await tx
        .select()
        .from(marketingContentItems)
        .where(
          and(
            eq(marketingContentItems.id, existing.resourceId),
            eq(marketingContentItems.businessId, access.businessId),
          ),
        )
        .limit(1);

      if (!content) {
        throw new Error("APPROVAL_CONTENT_NOT_FOUND");
      }

      await tx
        .update(marketingContentItems)
        .set({
          approvalStatus: status,
          updatedAt: now,
        })
        .where(
          and(
            eq(marketingContentItems.id, content.id),
            eq(marketingContentItems.businessId, access.businessId),
          ),
        );

      return {
        ok: true as const,
        resourceType: "content" as const,
        resourceId: content.id,
      };
    }

    throw new Error("UNSUPPORTED_APPROVAL_RESOURCE");
  }).catch((cause: unknown) => {
    if (cause instanceof Error) {
      if (cause.message === "APPROVAL_CAMPAIGN_NOT_FOUND") {
        return { error: "Approval campaign not found.", status: 404 } as const;
      }

      if (cause.message === "CAMPAIGN_NOT_PENDING_APPROVAL") {
        return {
          error:
            "Campaign must be pending approval before this review can be applied.",
          status: 409,
        } as const;
      }

      if (cause.message === "APPROVAL_CONTENT_NOT_FOUND") {
        return { error: "Approval content not found.", status: 404 } as const;
      }

      if (cause.message === "UNSUPPORTED_APPROVAL_RESOURCE") {
        return {
          error: "Unsupported approval resource type.",
          status: 400,
        } as const;
      }
    }

    throw cause;
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: "Approval could not be reviewed." },
      { status: 409 },
    );
  }

  if (result.resourceType === "campaign") {
    await createAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "marketing.campaign.approval_reviewed",
      resource: "marketing_campaign",
      resourceId: result.resourceId,
      description: "Marketing campaign approval reviewed.",
      metadata: {
        approvalId: existing.id,
        decision: status,
        from: result.from,
        to: result.to,
      },
    });
  } else {
    await createAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "marketing.content.approval_reviewed",
      resource: "marketing_content",
      resourceId: result.resourceId,
      description: "Marketing content approval reviewed.",
      metadata: {
        approvalId: existing.id,
        decision: status,
      },
    });
  }

  const [approval] = await db
    .select()
    .from(marketingApprovals)
    .where(
      and(
        eq(marketingApprovals.id, id),
        eq(marketingApprovals.businessId, access.businessId),
      ),
    )
    .limit(1);

  return NextResponse.json({ approval });
}
