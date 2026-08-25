import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import {
  leads,
  followUps,
  salesActivities,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";

import { runAutomationTrigger } from "@/lib/automations/engine";

export async function GET() {
  try {
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        { error: error || "You must be signed in." },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: error || "Business access denied." },
        { status: 403 },
      );
    }

    const businessLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.businessId, membership.businessId))
      .orderBy(desc(leads.createdAt));

    const businessFollowUps = await db
      .select()
      .from(followUps)
      .where(eq(followUps.businessId, membership.businessId))
      .orderBy(desc(followUps.dueAt));

    const businessActivities = await db
      .select()
      .from(salesActivities)
      .where(eq(salesActivities.businessId, membership.businessId))
      .orderBy(desc(salesActivities.createdAt));

    return NextResponse.json({
      leads: businessLeads,
      followUps: businessFollowUps,
      activities: businessActivities,
    });
  } catch (error) {
    console.error("Sales data error:", error);

    return NextResponse.json(
      { error: "Unable to load sales data." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        { error: error || "You must be signed in." },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: error || "Business access denied." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const service = String(body.service || "").trim();
    const source = String(body.source || "").trim();
    const notes = String(body.notes || "").trim();

    if (!name && !email && !phone) {
      return NextResponse.json(
        {
          error:
            "Please provide at least a name, email, or phone number.",
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const leadId = crypto.randomUUID();

    await db.insert(leads).values({
      id: leadId,
      businessId: membership.businessId,
      customerId: null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      service: service || null,
      destination: null,
      intent: null,
      notes: notes || null,
      studyLevel: null,
      program: null,
      university: null,
      preferredIntake: null,
      budget: null,
      source: source || "manual",
      stage: "new",
      assignedEmployeeId: null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    const createdLead = created[0];

    if (createdLead) {
      try {
        await runAutomationTrigger({
          businessId: membership.businessId,
          trigger: "lead.created",
          data: {
            leadId: createdLead.id,
            name: createdLead.name,
            email: createdLead.email,
            phone: createdLead.phone,
            service: createdLead.service,
            source: createdLead.source,
            stage: createdLead.stage,
            notes: createdLead.notes,
          },
        });
      } catch (automationError) {
        console.error(
          "Lead automation error:",
          automationError,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        lead: created[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Lead creation error:", error);

    return NextResponse.json(
      { error: "Unable to create lead." },
      { status: 500 },
    );
  }
}
