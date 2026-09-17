import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingApprovals } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

export async function GET() { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); return NextResponse.json({ approvals: await db.select().from(marketingApprovals).where(eq(marketingApprovals.businessId, access.businessId)).orderBy(desc(marketingApprovals.updatedAt)) }); }
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); if (typeof body?.resourceType !== "string" || typeof body?.resourceId !== "string") return NextResponse.json({ error: "resourceType and resourceId are required." }, { status: 400 }); const now = new Date(); const approval = { id: randomUUID(), businessId: access.businessId, resourceType: body.resourceType, resourceId: body.resourceId, status: "pending", requestedByUserId: access.userId, requestedByEmployeeId: null, reviewedByUserId: null, reviewedAt: null, comment: null, createdAt: now, updatedAt: now }; await db.insert(marketingApprovals).values(approval); return NextResponse.json({ approval }, { status: 201 }); }
