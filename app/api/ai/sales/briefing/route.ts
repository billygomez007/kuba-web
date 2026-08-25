import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  businesses,
  leads,
  followUps,
} from "@/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        { error: "No business found." },
        { status: 404 },
      );
    }

    const businessLeads = await db
      .select()
      .from(leads)
      .where(
        eq(
          leads.businessId,
          business.id,
        ),
      );

    const businessFollowUps = await db
      .select()
      .from(followUps)
      .where(
        eq(
          followUps.businessId,
          business.id,
        ),
      );

    const now = new Date();

    const overdue = businessFollowUps.filter(
      (item) =>
        item.status === "pending" &&
        new Date(item.dueAt) < now,
    );

    const pending = businessFollowUps.filter(
      (item) =>
        item.status === "pending",
    );

    const qualified = businessLeads.filter(
      (lead) =>
        lead.stage === "qualified",
    );

    const contacted = businessLeads.filter(
      (lead) =>
        lead.stage === "contacted",
    );

    const topLeads = businessLeads
      .map((lead) => {
        let score = 0;

        if (lead.stage === "qualified") {
          score += 40;
        }

        if (lead.stage === "contacted") {
          score += 25;
        }

        const leadFollowUps =
          businessFollowUps.filter(
            (item) =>
              item.leadId === lead.id,
          );

        const hasOverdue =
          leadFollowUps.some(
            (item) =>
              item.status === "pending" &&
              new Date(item.dueAt) < now,
          );

        if (hasOverdue) {
          score += 50;
        }

        return {
          id: lead.id,
          name: lead.name,
          stage: lead.stage,
          score,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .slice(0, 5);

    return NextResponse.json({
      success: true,

      greeting:
        "Good morning. Here is your sales briefing.",

      summary: {
        totalLeads: businessLeads.length,
        qualifiedLeads: qualified.length,
        contactedLeads: contacted.length,
        pendingFollowUps: pending.length,
        overdueFollowUps: overdue.length,
      },

      topLeads,

      recommendation:
        overdue.length > 0
          ? "Start with overdue follow-ups first."
          : "Focus on your highest priority qualified leads today.",
    });

  } catch (error) {
    console.error(
      "Sales briefing error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create sales briefing.",
      },
      { status: 500 },
    );
  }
}
