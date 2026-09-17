import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingAudiences, marketingAudienceRules } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const { id } = await params; const [audience] = await db.select({ id: marketingAudiences.id, estimatedCount: marketingAudiences.estimatedCount }).from(marketingAudiences).where(and(eq(marketingAudiences.id, id), eq(marketingAudiences.businessId, access.businessId))); if (!audience) return NextResponse.json({ error: "Audience not found." }, { status: 404 }); const rules = await db.select().from(marketingAudienceRules).where(and(eq(marketingAudienceRules.audienceId, id), eq(marketingAudienceRules.businessId, access.businessId))); return NextResponse.json({ audienceId: id, count: audience.estimatedCount, countStatus: audience.estimatedCount === null ? "unavailable" : "estimated", rules }); }
