import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingContentItems } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { marketingCampaignBelongsToBusiness } from "@/lib/marketing/ownership";

export async function GET() { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); return NextResponse.json({ content: await db.select().from(marketingContentItems).where(eq(marketingContentItems.businessId, access.businessId)).orderBy(desc(marketingContentItems.updatedAt)) }); }
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); const campaignId = typeof body?.campaignId === "string" ? body.campaignId : null; if (campaignId && !(await marketingCampaignBelongsToBusiness(access.businessId, campaignId))) return NextResponse.json({ error: "Campaign does not belong to this business." }, { status: 403 }); const title = typeof body?.title === "string" ? body.title.trim() : ""; if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 }); const now = new Date(); const item = { id: randomUUID(), businessId: access.businessId, campaignId, title, contentType: typeof body?.contentType === "string" ? body.contentType : "post", brief: typeof body?.brief === "string" ? body.brief : null, status: "draft", approvalStatus: "draft", createdByUserId: null, createdByEmployeeId: null, metadata: null, createdAt: now, updatedAt: now }; await db.insert(marketingContentItems).values(item); return NextResponse.json({ content: item }, { status: 201 }); }
