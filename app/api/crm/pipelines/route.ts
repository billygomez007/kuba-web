import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { crmPipelines, crmPipelineStages } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

async function access() { const membership = await getCurrentMembership(); if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.RECEPTION_VIEW)) return null; return membership; }
export async function GET() { const membership = await access(); if (!membership) return NextResponse.json({ error: "CRM access denied." }, { status: 403 }); const pipelines = await db.select().from(crmPipelines).where(eq(crmPipelines.businessId, membership.businessId)); const stages = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.businessId, membership.businessId)).orderBy(asc(crmPipelineStages.position)); return NextResponse.json({ pipelines: pipelines.map((pipeline) => ({ ...pipeline, stages: stages.filter((stage) => stage.pipelineId === pipeline.id) })) }); }
export async function POST(request: Request) { const membership = await access(); if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.RECEPTION_MANAGE)) return NextResponse.json({ error: "CRM management denied." }, { status: 403 }); const body = await request.json(); const name = String(body.name || "").trim(); if (!name) return NextResponse.json({ error: "Pipeline name is required." }, { status: 400 }); const now = new Date(); const id = crypto.randomUUID(); await db.insert(crmPipelines).values({ id, businessId: membership.businessId, name, description: body.description || null, isDefault: Boolean(body.isDefault), status: "active", createdAt: now, updatedAt: now }); return NextResponse.json({ success: true, id }, { status: 201 }); }
