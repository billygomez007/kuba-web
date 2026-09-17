import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  marketingContentItems,
  marketingContentVariants,
} from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import {
  MARKETING_CHANNELS,
  requireMarketingAccess,
} from "@/lib/marketing/context";
import { marketingContentBelongsToBusiness } from "@/lib/marketing/ownership";

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

  const [item] = await db
    .select({ id: marketingContentItems.id })
    .from(marketingContentItems)
    .where(
      and(
        eq(marketingContentItems.id, id),
        eq(marketingContentItems.businessId, access.businessId),
      ),
    )
    .limit(1);

  if (!item) {
    return NextResponse.json(
      { error: "Content not found." },
      { status: 404 },
    );
  }

  const variants = await db
    .select()
    .from(marketingContentVariants)
    .where(
      and(
        eq(marketingContentVariants.contentItemId, id),
        eq(marketingContentVariants.businessId, access.businessId),
      ),
    );

  return NextResponse.json({ variants });
}

export async function POST(
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

  const content = await marketingContentBelongsToBusiness(
    access.businessId,
    id,
  );

  if (!content) {
    return NextResponse.json(
      { error: "Content not found." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);

  const channel =
    typeof body?.channel === "string"
      ? body.channel
      : "";

  if (!MARKETING_CHANNELS.includes(channel as never)) {
    return NextResponse.json(
      { error: "Unsupported channel." },
      { status: 400 },
    );
  }

  const text =
    typeof body?.text === "string"
      ? body.text.trim()
      : "";

  if (!text) {
    return NextResponse.json(
      { error: "Variant text is required." },
      { status: 400 },
    );
  }

  if (
    body &&
    ("scheduledAt" in body || "status" in body)
  ) {
    return NextResponse.json(
      {
        error:
          "Variant scheduling and status are controlled by the Marketing publishing workflow.",
      },
      { status: 409 },
    );
  }

  const [existing] = await db
    .select({ id: marketingContentVariants.id })
    .from(marketingContentVariants)
    .where(
      and(
        eq(marketingContentVariants.businessId, access.businessId),
        eq(marketingContentVariants.contentItemId, id),
        eq(marketingContentVariants.channel, channel),
      ),
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error:
          "A variant already exists for this content and channel.",
      },
      { status: 409 },
    );
  }

  const now = new Date();

  const variant = {
    id: randomUUID(),
    businessId: access.businessId,
    contentItemId: id,
    channel,
    headline:
      typeof body?.headline === "string"
        ? body.headline.trim() || null
        : null,
    text,
    description:
      typeof body?.description === "string"
        ? body.description.trim() || null
        : null,
    callToAction:
      typeof body?.callToAction === "string"
        ? body.callToAction.trim() || null
        : null,
    linkUrl:
      typeof body?.linkUrl === "string"
        ? body.linkUrl.trim() || null
        : null,
    hashtags:
      typeof body?.hashtags === "string"
        ? body.hashtags.trim() || null
        : null,
    scheduledAt: null,
    status: "draft",
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(marketingContentVariants).values(variant);

  await createAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "marketing.content_variant.created",
    resource: "marketing_content",
    resourceId: id,
    description: `Marketing ${channel} content variant created.`,
    metadata: {
      variantId: variant.id,
      channel,
    },
  });

  return NextResponse.json(
    { variant },
    { status: 201 },
  );
}
