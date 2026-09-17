import { and, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingContentVariants, marketingPublishJobs } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

export async function GET(request: Request) { const access = await requireMarketingAccess("view"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const url = new URL(request.url); const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : new Date(0); const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : new Date("2100-01-01"); const [variants, jobs] = await Promise.all([db.select().from(marketingContentVariants).where(and(eq(marketingContentVariants.businessId, access.businessId), gte(marketingContentVariants.scheduledAt, from), lte(marketingContentVariants.scheduledAt, to))), db.select().from(marketingPublishJobs).where(and(eq(marketingPublishJobs.businessId, access.businessId), gte(marketingPublishJobs.scheduledAt, from), lte(marketingPublishJobs.scheduledAt, to)))]); return NextResponse.json({ variants, jobs }); }
