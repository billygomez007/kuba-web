import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { crmDeals, crmPipelineStages, leads } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.RECEPTION_MANAGE)) return NextResponse.json({ error: "CRM management denied." }, { status: 403 });
  const { id } = await context.params;
  const lead = (await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.businessId, membership.businessId))).limit(1))[0];
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const existing = (await db.select({ id: crmDeals.id }).from(crmDeals).where(and(eq(crmDeals.businessId, membership.businessId), eq(crmDeals.leadId, id), eq(crmDeals.status, "open"))).limit(1))[0];
  if (existing) return NextResponse.json({ id: existing.id, existing: true });
  const body = await request.json();
  const stage = (await db.select().from(crmPipelineStages).where(and(eq(crmPipelineStages.id, String(body.stageId || "")), eq(crmPipelineStages.pipelineId, String(body.pipelineId || "")), eq(crmPipelineStages.businessId, membership.businessId))).limit(1))[0];
  if (!stage) return NextResponse.json({ error: "Valid pipeline stage is required." }, { status: 400 });
  const now = new Date(); const dealId = crypto.randomUUID(); const status = stage.stageType === "won" ? "won" : stage.stageType === "lost" ? "lost" : "open";
  await db.insert(crmDeals).values({ id: dealId, businessId: membership.businessId, customerId: lead.customerId, leadId: lead.id, title: body.title || lead.name || "Qualified opportunity", description: lead.notes || null, pipelineId: stage.pipelineId, stageId: stage.id, assignedEmployeeId: lead.assignedEmployeeId, assignedUserId: null, status, value: body.value || lead.estimatedValue || null, currency: body.currency || lead.currency || "GHS", expectedCloseDate: null, actualCloseDate: status === "open" ? null : now, source: lead.source || null, productInterest: lead.service || null, nextAction: body.nextAction || null, nextActionDate: null, lossReason: null, createdAt: now, updatedAt: now });
  await createAuditLog({ businessId: membership.businessId, userId: membership.userId, action: "crm.lead.converted", resource: "deal", resourceId: dealId, metadata: { leadId: id } });
  return NextResponse.json({ success: true, id: dealId }, { status: 201 });
}
