import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingAttributions } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

export async function GET() { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); return NextResponse.json({ attributions: await db.select().from(marketingAttributions).where(eq(marketingAttributions.businessId, access.businessId)).orderBy(desc(marketingAttributions.occurredAt)) }); }
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); if (typeof body?.campaignId !== "string" || typeof body?.eventType !== "string") return NextResponse.json({ error: "campaignId and eventType are required." }, { status: 400 }); const now = new Date(); const attribution = { id: randomUUID(), businessId: access.businessId, campaignId: body.campaignId, customerId: typeof body?.customerId === "string" ? body.customerId : null, leadId: typeof body?.leadId === "string" ? body.leadId : null, dealId: typeof body?.dealId === "string" ? body.dealId : null, eventType: body.eventType, occurredAt: body?.occurredAt ? new Date(body.occurredAt) : now, value: typeof body?.value === "number" ? body.value : null, currency: typeof body?.currency === "string" ? body.currency : null, metadata: null, createdAt: now }; await db.insert(marketingAttributions).values(attribution); return NextResponse.json({ attribution }, { status: 201 }); }
