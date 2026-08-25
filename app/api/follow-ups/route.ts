import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  businesses,
  followUps,
  leads,
} from "@/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      );
    }

    const results = await db
      .select({
        followUp: followUps,
        lead: leads,
      })
      .from(followUps)
      .innerJoin(
        leads,
        eq(followUps.leadId, leads.id),
      )
      .where(eq(followUps.businessId, business.id))
      .orderBy(desc(followUps.dueAt));

    return NextResponse.json({
      followUps: results,
    });
  } catch (error) {
    console.error("Follow-up loading error:", error);

    return NextResponse.json(
      { error: "Unable to load follow-ups." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      );
    }

    const body = await request.json();

    const leadId = String(body.leadId || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const assignedEmployeeId = body.assignedEmployeeId
      ? String(body.assignedEmployeeId).trim()
      : null;

    const dueAtValue = body.dueAt;

    if (!leadId || !title || !dueAtValue) {
      return NextResponse.json(
        {
          error:
            "Lead, title, and due date are required.",
        },
        { status: 400 },
      );
    }

    const dueAt = new Date(dueAtValue);

    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid follow-up date." },
        { status: 400 },
      );
    }

    const lead = await db
      .select({
        id: leads.id,
      })
      .from(leads)
      .where(
        and(
          eq(leads.id, leadId),
          eq(leads.businessId, business.id),
        ),
      )
      .limit(1);

    if (!lead[0]) {
      return NextResponse.json(
        { error: "Lead not found for this business." },
        { status: 404 },
      );
    }

    const now = new Date();
    const followUpId = crypto.randomUUID();

    await db.insert(followUps).values({
      id: followUpId,
      businessId: business.id,
      leadId,
      assignedEmployeeId,
      title,
      description: description || null,
      dueAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(followUps)
      .where(eq(followUps.id, followUpId))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        followUp: created[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Follow-up creation error:", error);

    return NextResponse.json(
      { error: "Unable to create follow-up." },
      { status: 500 },
    );
  }
}
