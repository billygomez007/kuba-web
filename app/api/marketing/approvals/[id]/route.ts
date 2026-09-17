import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingApprovals } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const { id } = await params; const body = await request.json().catch(() => null); const status = body?.status; if (!["approved", "rejected", "changes_requested"].includes(status)) return NextResponse.json({ error: "Unsupported approval status." }, { status: 400 }); const result = await db.update(marketingApprovals).set({ status, reviewedByUserId: access.userId, reviewedAt: new Date(), comment: typeof body?.comment === "string" ? body.comment : null, updatedAt: new Date() }).where(and(eq(marketingApprovals.id, id), eq(marketingApprovals.businessId, access.businessId))); if (result.rowsAffected === 0) return NextResponse.json({ error: "Approval not found." }, { status: 404 }); const [approval] = await db.select().from(marketingApprovals).where(and(eq(marketingApprovals.id, id), eq(marketingApprovals.businessId, access.businessId))); return NextResponse.json({ approval }); }
