import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingContentItems } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { isMarketingContentType } from "@/lib/marketing/content-policy";
import { getMarketingContentOperations } from "@/lib/marketing/content-operations";
import { marketingCampaignBelongsToBusiness } from "@/lib/marketing/ownership";

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
  const operations = await getMarketingContentOperations(
    access.businessId,
    id,
  );

  if (!operations) {
    return NextResponse.json(
      { error: "Content not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...operations,
    capabilities: access.capabilities,
    currentUserId: access.userId,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const { id } = await params; const body = await request.json().catch(() => null); if (body && "campaignId" in body && body.campaignId !== null) { if (typeof body.campaignId !== "string") return NextResponse.json({ error: "campaignId must be a string or null." }, { status: 400 }); if (!(await marketingCampaignBelongsToBusiness(access.businessId, body.campaignId))) return NextResponse.json({ error: "Campaign does not belong to this business." }, { status: 403 }); } if (body && "approvalStatus" in body) return NextResponse.json({ error: "Content approval status is controlled by the Marketing approval workflow." }, { status: 409 }); if (body && "status" in body) return NextResponse.json({ error: "Content status cannot be changed directly." }, { status: 409 }); if (body && "contentType" in body && !isMarketingContentType(body.contentType)) return NextResponse.json({ error: "Unsupported content type." }, { status: 400 }); const patch: Record<string, unknown> = {}; for (const key of ["title", "contentType", "brief", "campaignId"]) if (body && key in body) patch[key] = body[key]; patch.updatedAt = new Date(); const result = await db.update(marketingContentItems).set(patch).where(and(eq(marketingContentItems.id, id), eq(marketingContentItems.businessId, access.businessId))); if (result.rowsAffected === 0) return NextResponse.json({ error: "Content not found." }, { status: 404 }); const operations = await getMarketingContentOperations(
    access.businessId,
    id,
  );

  if (!operations) {
    return NextResponse.json(
      { error: "Content not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...operations,
    capabilities: access.capabilities,
    currentUserId: access.userId,
  }); }
