import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crmDeals } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
export async function GET() { const membership = await getCurrentMembership(); if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.CRM_VIEW)) return NextResponse.json({ error: "CRM access denied." }, { status: 403 }); const deals = await db.select().from(crmDeals).where(eq(crmDeals.businessId, membership.businessId)); const open = deals.filter((deal) => deal.status === "open"); return NextResponse.json({ openDeals: open.length, wonDeals: deals.filter((deal) => deal.status === "won").length, lostDeals: deals.filter((deal) => deal.status === "lost").length, openValue: open.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0), wonValue: deals.filter((deal) => deal.status === "won").reduce((sum, deal) => sum + (Number(deal.value) || 0), 0), conversionCount: deals.filter((deal) => Boolean(deal.leadId)).length }); }
