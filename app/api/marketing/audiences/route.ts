import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingAudiences } from "@/db/schema";
import { requireMarketingAccess, SAFE_AUDIENCE_FIELDS } from "@/lib/marketing/context";

export async function GET() { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); return NextResponse.json({ audiences: await db.select().from(marketingAudiences).where(eq(marketingAudiences.businessId, access.businessId)).orderBy(desc(marketingAudiences.updatedAt)) }); }
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); const name = typeof body?.name === "string" ? body.name.trim() : ""; if (!name) return NextResponse.json({ error: "Audience name is required." }, { status: 400 }); const rules = Array.isArray(body?.rules) ? body.rules : []; if (rules.some((rule: unknown) => !rule || typeof rule !== "object" || !SAFE_AUDIENCE_FIELDS.includes((rule as { field?: string }).field as never))) return NextResponse.json({ error: "Audience contains an unsupported targeting field." }, { status: 400 }); const now = new Date(); const audience = { id: randomUUID(), businessId: access.businessId, name, description: typeof body?.description === "string" ? body.description : null, status: "draft", estimatedCount: null, createdBy: access.userId, createdAt: now, updatedAt: now }; await db.insert(marketingAudiences).values(audience); return NextResponse.json({ audience }, { status: 201 }); }
