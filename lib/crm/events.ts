import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiEmployees, crmDeals, tasks } from "@/db/schema";
import { runAutomationTrigger } from "@/lib/automations/engine";
export type CrmEvent = "crm.lead.converted" | "crm.deal.created" | "crm.deal.stage_changed" | "crm.deal.won" | "crm.deal.lost" | "crm.deal.reopened";
export async function emitCrmEvent(businessId: string, trigger: CrmEvent, data: Record<string, unknown>) { await runAutomationTrigger({ businessId, trigger, data: { ...data, businessId, occurredAt: new Date().toISOString() } }); }
export async function createWonOperationsHandoff(businessId: string, dealId: string) {
 const deal = (await db.select().from(crmDeals).where(and(eq(crmDeals.id, dealId), eq(crmDeals.businessId, businessId))).limit(1))[0]; if (!deal) return null;
 const title = `Onboard customer — ${deal.title}`; const existing = (await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.businessId, businessId), eq(tasks.dealId, dealId), eq(tasks.title, title))).limit(1))[0]; if (existing) return existing.id;
 const employee = (await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.businessId, businessId), eq(aiEmployees.type, "operations"), eq(aiEmployees.status, "active"))).limit(1))[0];
 const id = crypto.randomUUID(); const now = new Date(); await db.insert(tasks).values({ id, businessId, title, description: `Post-sale onboarding for ${deal.productInterest || "the won deal"}.`, status: "pending", priority: "high", assignedUserId: deal.assignedUserId || null, assignedEmployeeId: employee?.id || null, customerId: deal.customerId || null, dealId, leadId: deal.leadId || null, createdAt: now, updatedAt: now }); return id;
}
