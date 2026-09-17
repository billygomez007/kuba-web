import { and, asc, count, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { marketingCampaigns } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { createAuditLog } from "@/lib/auth/audit";

export async function GET(request: Request) {
  const access = await requireMarketingAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const url = new URL(request.url);
  const parsedPage = Number(url.searchParams.get("page") || 1);
  const parsedPageSize = Number(url.searchParams.get("pageSize") || 20);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1;
  const pageSize = Number.isFinite(parsedPageSize) ? Math.min(50, Math.max(1, Math.floor(parsedPageSize))) : 20;
  const status = url.searchParams.get("status")?.trim();
  const objective = url.searchParams.get("objective")?.trim();
  const ownerUserId = url.searchParams.get("ownerUserId")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const conditions = [eq(marketingCampaigns.businessId, access.businessId)];
  if (status) conditions.push(eq(marketingCampaigns.status, status));
  if (objective) conditions.push(eq(marketingCampaigns.objective, objective));
  if (ownerUserId) conditions.push(eq(marketingCampaigns.ownerUserId, ownerUserId));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(like(marketingCampaigns.name, pattern), like(marketingCampaigns.description, pattern))!);
  }
  if (startDate && !Number.isNaN(Date.parse(startDate))) conditions.push(gte(marketingCampaigns.startAt, new Date(startDate)));
  if (endDate && !Number.isNaN(Date.parse(endDate))) conditions.push(lte(marketingCampaigns.endAt, new Date(endDate)));
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(marketingCampaigns).where(where);
  const campaigns = await db.select().from(marketingCampaigns).where(where)
    .orderBy(desc(marketingCampaigns.updatedAt), asc(marketingCampaigns.id))
    .limit(pageSize).offset((page - 1) * pageSize);
  const numericTotal = Number(total ?? 0);
  return NextResponse.json({ campaigns, pagination: { page, pageSize, total: numericTotal, totalPages: Math.max(1, Math.ceil(numericTotal / pageSize)) } });
}
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); const name = typeof body?.name === "string" ? body.name.trim() : ""; if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 }); const now = new Date(); const campaign = { id: randomUUID(), businessId: access.businessId, name, description: typeof body?.description === "string" ? body.description : null, objective: typeof body?.objective === "string" ? body.objective : "other", campaignType: typeof body?.campaignType === "string" ? body.campaignType : "organic", status: "draft", targetAudienceId: typeof body?.targetAudienceId === "string" ? body.targetAudienceId : null, offer: typeof body?.offer === "string" ? body.offer : null, landingUrl: typeof body?.landingUrl === "string" ? body.landingUrl : null, timezone: typeof body?.timezone === "string" ? body.timezone : null, startAt: body?.startAt ? new Date(body.startAt) : null, endAt: body?.endAt ? new Date(body.endAt) : null, budgetAmount: typeof body?.budgetAmount === "number" ? body.budgetAmount : null, budgetCurrency: typeof body?.budgetCurrency === "string" ? body.budgetCurrency : "USD", ownerUserId: null, ownerEmployeeId: null, approvalStatus: "draft", createdByUserId: null, createdByEmployeeId: null, metadata: null, createdAt: now, updatedAt: now }; await db.insert(marketingCampaigns).values(campaign); await createAuditLog({ businessId: access.businessId, userId: access.userId, action: "marketing.campaign.created", resource: "marketing_campaign", resourceId: campaign.id, description: "Marketing campaign created.", metadata: { status: campaign.status } }); return NextResponse.json({ campaign }, { status: 201 }); }
