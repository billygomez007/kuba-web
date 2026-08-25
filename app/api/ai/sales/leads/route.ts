import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  businesses,
  leads,
} from "@/db/schema";

export async function GET() {
  try {
    // ---------------------------------------------------------
    // 1. Authenticate user
    // ---------------------------------------------------------

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 },
      );
    }

    // ---------------------------------------------------------
    // 2. Find the user's business
    // ---------------------------------------------------------

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        { status: 404 },
      );
    }

    // ---------------------------------------------------------
    // 3. Load this business's leads
    // ---------------------------------------------------------

    const businessLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,

        service: leads.service,
        destination: leads.destination,
        intent: leads.intent,
        notes: leads.notes,

        studyLevel: leads.studyLevel,
        program: leads.program,
        university: leads.university,
        preferredIntake:
          leads.preferredIntake,
        budget: leads.budget,

        source: leads.source,
        stage: leads.stage,
        assignedEmployeeId:
          leads.assignedEmployeeId,

        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,

        customerId: leads.customerId,
      })
      .from(leads)
      .where(
        eq(
          leads.businessId,
          business.id,
        ),
      )
      .orderBy(
        desc(leads.updatedAt),
      );

    // ---------------------------------------------------------
    // 4. Return leads
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      leads: businessLeads,
    });
  } catch (error) {
    console.error(
      "Kuba Sales Leads error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Kuba Sales could not load leads.",
      },
      { status: 500 },
    );
  }
}
