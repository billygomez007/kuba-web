import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingSocialAccounts } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

const providers = ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube", "telegram"];
export async function GET() { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); return NextResponse.json({ accounts: await db.select().from(marketingSocialAccounts).where(eq(marketingSocialAccounts.businessId, access.businessId)).orderBy(desc(marketingSocialAccounts.updatedAt)), providers }); }
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); const provider = typeof body?.provider === "string" ? body.provider : ""; if (!providers.includes(provider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 400 }); return NextResponse.json({ error: "Provider connection is not available yet.", code: "PROVIDER_NOT_CONNECTED" }, { status: 409 }); }
