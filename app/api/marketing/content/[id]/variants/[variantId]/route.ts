import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingContentVariants } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { requireMarketingAccess } from "@/lib/marketing/context";
import {
  marketingContentBelongsToBusiness,
  marketingVariantBelongsToBusiness,
} from "@/lib/marketing/ownership";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      variantId: string;
    }>;
  },
) {
  const access = await requireMarketingAccess("manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { id, variantId } = await params;

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

  const variant = await marketingVariantBelongsToBusiness(
    access.businessId,
    variantId,
  );

  if (!variant) {
    return NextResponse.json(
      { error: "Content variant not found." },
      { status: 404 },
    );
  }

  if (variant.contentItemId !== id) {
    return NextResponse.json(
      {
        error:
          "Content variant does not belong to this content item.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);

  if (
    body &&
    (
      "businessId" in body ||
      "contentItemId" in body ||
      "channel" in body
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Variant ownership and channel cannot be changed.",
      },
      { status: 409 },
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

  const patch: Record<string, unknown> = {};

  for (const key of [
    "headline",
    "description",
    "callToAction",
    "linkUrl",
    "hashtags",
  ]) {
    if (body && key in body) {
      patch[key] =
        typeof body[key] === "string"
          ? body[key].trim() || null
          : null;
    }
  }

  if (body && "text" in body) {
    if (
      typeof body.text !== "string" ||
      !body.text.trim()
    ) {
      return NextResponse.json(
        { error: "Variant text is required." },
        { status: 400 },
      );
    }

    patch.text = body.text.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable variant fields were provided." },
      { status: 400 },
    );
  }

  patch.updatedAt = new Date();

  const result = await db
    .update(marketingContentVariants)
    .set(patch)
    .where(
      and(
        eq(marketingContentVariants.id, variantId),
        eq(
          marketingContentVariants.businessId,
          access.businessId,
        ),
        eq(marketingContentVariants.contentItemId, id),
      ),
    );

  if (result.rowsAffected === 0) {
    return NextResponse.json(
      { error: "Content variant not found." },
      { status: 404 },
    );
  }

  await createAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "marketing.content_variant.updated",
    resource: "marketing_content",
    resourceId: id,
    description: "Marketing content variant updated.",
    metadata: {
      variantId,
    },
  });

  const [updated] = await db
    .select()
    .from(marketingContentVariants)
    .where(
      and(
        eq(marketingContentVariants.id, variantId),
        eq(
          marketingContentVariants.businessId,
          access.businessId,
        ),
        eq(marketingContentVariants.contentItemId, id),
      ),
    )
    .limit(1);

  return NextResponse.json({ variant: updated });
}
