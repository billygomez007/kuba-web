import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingContentItems } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import {
  isMarketingContentType,
  MARKETING_CONTENT_TYPES,
} from "@/lib/marketing/content-policy";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { marketingCampaignBelongsToBusiness } from "@/lib/marketing/ownership";

export async function GET() {
  const access = await requireMarketingAccess("view");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const content = await db
    .select()
    .from(marketingContentItems)
    .where(eq(marketingContentItems.businessId, access.businessId))
    .orderBy(desc(marketingContentItems.updatedAt));

  return NextResponse.json({ content });
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

  const title =
    typeof body?.title === "string"
      ? body.title.trim()
      : "";

  if (!title) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400 },
    );
  }

  const contentType =
    body?.contentType === undefined
      ? "post"
      : body.contentType;

  if (!isMarketingContentType(contentType)) {
    return NextResponse.json(
      {
        error: "Unsupported content type.",
        allowedContentTypes: MARKETING_CONTENT_TYPES,
      },
      { status: 400 },
    );
  }

  let campaignId: string | null = null;

  if (
    body &&
    "campaignId" in body &&
    body.campaignId !== null &&
    body.campaignId !== ""
  ) {
    if (typeof body.campaignId !== "string") {
      return NextResponse.json(
        { error: "campaignId must be a string or null." },
        { status: 400 },
      );
    }

    if (
      !(await marketingCampaignBelongsToBusiness(
        access.businessId,
        body.campaignId,
      ))
    ) {
      return NextResponse.json(
        { error: "Campaign does not belong to this business." },
        { status: 403 },
      );
    }

    campaignId = body.campaignId;
  }

  const now = new Date();

  const item = {
    id: randomUUID(),
    businessId: access.businessId,
    campaignId,
    title,
    contentType,
    brief:
      typeof body?.brief === "string"
        ? body.brief.trim() || null
        : null,
    status: "draft",
    approvalStatus: "draft",
    createdByUserId: access.userId,
    createdByEmployeeId: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(marketingContentItems).values(item);

  await createAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "marketing.content.created",
    resource: "marketing_content",
    resourceId: item.id,
    description: "Marketing content created.",
    metadata: {
      contentType: item.contentType,
      campaignId: item.campaignId,
    },
  });

  return NextResponse.json(
    { content: item },
    { status: 201 },
  );
}
