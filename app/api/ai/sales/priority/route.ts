import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
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

    const businessResult = await db
      .select({
        business: businesses,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(businessUsers.businessId, businesses.id),
      )
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);

    const business = businessResult[0]?.business;

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        { status: 404 },
      );
    }

    const businessLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(
        eq(leads.businessId, business.id),
      );

    const businessFollowUps = await db
      .select({
        id: followUps.id,
        leadId: followUps.leadId,
        title: followUps.title,
        dueAt: followUps.dueAt,
        status: followUps.status,
      })
      .from(followUps)
      .where(
        eq(
          followUps.businessId,
          business.id,
        ),
      );

    const now = new Date();

    const prioritizedLeads = businessLeads
      .map((lead) => {
        let score = 0;
        const reasons: string[] = [];

        if (lead.stage === "qualified") {
          score += 40;
          reasons.push("Lead is qualified.");
        } else if (lead.stage === "contacted") {
          score += 25;
          reasons.push(
            "Lead has already been contacted.",
          );
        } else if (lead.stage === "new") {
          score += 15;
          reasons.push(
            "Lead is new and has not yet progressed.",
          );
        }

        const leadFollowUps =
          businessFollowUps.filter(
            (followUp) =>
              followUp.leadId === lead.id,
          );

        const pendingFollowUps =
          leadFollowUps.filter(
            (followUp) =>
              followUp.status === "pending",
          );

        const overdueFollowUps =
          pendingFollowUps.filter(
            (followUp) =>
              new Date(followUp.dueAt) < now,
          );

        if (overdueFollowUps.length > 0) {
          score += 50;
          reasons.push(
            "Lead has an overdue follow-up.",
          );
        } else if (
          pendingFollowUps.length > 0
        ) {
          score += 30;
          reasons.push(
            "Lead has a pending follow-up.",
          );
        }

        const createdAt =
          new Date(lead.createdAt);

        const ageInDays =
          (now.getTime() -
            createdAt.getTime()) /
          (1000 * 60 * 60 * 24);

        if (ageInDays >= 7) {
          score += 10;
          reasons.push(
            "Lead has been in the pipeline for more than 7 days.",
          );
        }

        return {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          stage: lead.stage,
          score,
          reasons,
          pendingFollowUps:
            pendingFollowUps.length,
          overdueFollowUps:
            overdueFollowUps.length,
        };
      })
      .sort(
        (a, b) => b.score - a.score,
      );

    const stageCounts =
      businessLeads.reduce<
        Record<string, number>
      >((counts, lead) => {
        const stage =
          lead.stage || "unknown";

        counts[stage] =
          (counts[stage] || 0) + 1;

        return counts;
      }, {});

    const pendingFollowUps =
      businessFollowUps.filter(
        (followUp) =>
          followUp.status === "pending",
      );

    const completedFollowUps =
      businessFollowUps.filter(
        (followUp) =>
          followUp.status === "completed",
      );

    const overdueFollowUps =
      pendingFollowUps.filter(
        (followUp) =>
          new Date(followUp.dueAt) < now,
      );

    const upcomingFollowUps =
      pendingFollowUps.filter(
        (followUp) =>
          new Date(followUp.dueAt) >= now,
      );

    return NextResponse.json({
      success: true,

      summary: {
        totalLeads:
          businessLeads.length,

        stageCounts,

        qualifiedLeads:
          businessLeads.filter(
            (lead) =>
              lead.stage === "qualified",
          ).length,

        convertedLeads:
          businessLeads.filter(
            (lead) =>
              lead.stage === "converted",
          ).length,

        pendingFollowUps:
          pendingFollowUps.length,

        completedFollowUps:
          completedFollowUps.length,

        overdueFollowUps:
          overdueFollowUps.length,

        upcomingFollowUps:
          upcomingFollowUps.length,
      },

      priorities:
        prioritizedLeads.slice(0, 10),
    });
  } catch (error) {
    console.error(
      "Sales priority error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load sales priorities.",
      },
      { status: 500 },
    );
  }
}
