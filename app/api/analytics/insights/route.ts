import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, count, eq, lt, sql } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

import {
  leads,
  tasks,
  followUps,
  aiEmployees,
  automationRuns,
} from "@/db/schema";

export async function GET() {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business not found.",
        },
        { status: 404 },
      );
    }

    if (!hasPermission(business.role, business.permissions, PERMISSIONS.ANALYTICS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "intelligence.basic")) {
      return NextResponse.json({ error: "Insights require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
    }

    const businessId =
      business.businessId;

    const [
      leadResult,
      qualifiedResult,
      overdueTasksResult,
      overdueFollowUpsResult,
      employeeResult,
      automationResult,
    ] = await Promise.all([
      db
        .select({
          count: count(),
        })
        .from(leads)
        .where(
          eq(
            leads.businessId,
            businessId,
          ),
        ),

      db
        .select({
          count: count(),
        })
        .from(leads)
        .where(
          and(
            eq(
              leads.businessId,
              businessId,
            ),
            sql`LOWER(${leads.stage}) = 'qualified'`,
          ),
        ),

      db
        .select({
          count: count(),
        })
        .from(tasks)
        .where(
          and(
            eq(
              tasks.businessId,
              businessId,
            ),
            lt(
              tasks.dueAt,
              new Date(),
            ),
            sql`LOWER(${tasks.status}) != 'completed'`,
          ),
        ),

      db
        .select({
          count: count(),
        })
        .from(followUps)
        .where(
          and(
            eq(
              followUps.businessId,
              businessId,
            ),
            lt(
              followUps.dueAt,
              new Date(),
            ),
            sql`LOWER(${followUps.status}) != 'completed'`,
          ),
        ),

      db
        .select({
          count: count(),
        })
        .from(aiEmployees)
        .where(
          eq(
            aiEmployees.businessId,
            businessId,
          ),
        ),

      db
        .select({
          count: count(),
        })
        .from(automationRuns)
        .where(
          and(
            eq(
              automationRuns.businessId,
              businessId,
            ),
            eq(
              automationRuns.status,
              "completed",
            ),
          ),
        ),
    ]);

    const totalLeads =
      Number(
        leadResult[0]?.count || 0,
      );

    const qualifiedLeads =
      Number(
        qualifiedResult[0]?.count || 0,
      );

    const overdueTasks =
      Number(
        overdueTasksResult[0]?.count || 0,
      );

    const overdueFollowUps =
      Number(
        overdueFollowUpsResult[0]?.count || 0,
      );

    const employees =
      Number(
        employeeResult[0]?.count || 0,
      );

    const successfulAutomations =
      Number(
        automationResult[0]?.count || 0,
      );

    const conversionRate =
      totalLeads > 0
        ? Number(
            (
              (qualifiedLeads /
                totalLeads) *
              100
            ).toFixed(1),
          )
        : 0;

    const insights: {
      type:
        | "sales"
        | "operations"
        | "workforce"
        | "automation";
      title: string;
      message: string;
      priority:
        | "high"
        | "medium"
        | "low";
    }[] = [];

    /*
     * SALES
     */

    if (totalLeads === 0) {
      insights.push({
        type: "sales",
        title:
          "No sales pipeline yet",
        message:
          "Kuba has not recorded any leads for this business yet. Connect your sales channels or add your first leads to begin measuring sales performance.",
        priority: "high",
      });
    } else if (
      conversionRate < 10
    ) {
      insights.push({
        type: "sales",
        title:
          "Lead qualification is low",
        message:
          `${conversionRate}% of your ${totalLeads} leads are currently qualified. Sales should review lead quality, follow-up speed and qualification criteria.`,
        priority: "high",
      });
    } else if (
      conversionRate >= 30
    ) {
      insights.push({
        type: "sales",
        title:
          "Strong lead qualification",
        message:
          `${conversionRate}% of your leads are qualified. Your sales pipeline is showing healthy qualification activity.`,
        priority: "low",
      });
    } else {
      insights.push({
        type: "sales",
        title:
          "Sales pipeline is developing",
        message:
          `${conversionRate}% of your ${totalLeads} leads are qualified. Continue monitoring follow-up speed and conversion quality.`,
        priority: "medium",
      });
    }

    /*
     * OPERATIONS
     */

    const overdueWork =
      overdueTasks +
      overdueFollowUps;

    if (overdueWork > 0) {
      insights.push({
        type: "operations",
        title:
          "Overdue work needs attention",
        message:
          `There are ${overdueWork} overdue items across tasks and follow-ups. Clearing these items should be a near-term operational priority.`,
        priority:
          overdueWork >= 5
            ? "high"
            : "medium",
      });
    } else {
      insights.push({
        type: "operations",
        title:
          "Operations are on schedule",
        message:
          "There are currently no overdue tasks or follow-ups requiring immediate attention.",
        priority: "low",
      });
    }

    /*
     * AI WORKFORCE
     */

    if (employees === 0) {
      insights.push({
        type: "workforce",
        title:
          "AI workforce not configured",
        message:
          "No AI employees are currently configured. Add AI employees to begin distributing work across the Kuba workforce.",
        priority: "medium",
      });
    } else {
      insights.push({
        type: "workforce",
        title:
          "AI workforce active",
        message:
          `Kuba currently has ${employees} AI employee${employees === 1 ? "" : "s"} configured and available to support business operations.`,
        priority: "low",
      });
    }

    /*
     * AUTOMATION
     */

    if (
      successfulAutomations > 0
    ) {
      insights.push({
        type: "automation",
        title:
          "Automation is working",
        message:
          `${successfulAutomations} automation run${successfulAutomations === 1 ? "" : "s"} have completed successfully.`,
        priority: "low",
      });
    } else {
      insights.push({
        type: "automation",
        title:
          "Automation opportunity",
        message:
          "No successful automation runs have been recorded yet. Automating repetitive follow-ups and task assignments could reduce manual work.",
        priority: "medium",
      });
    }

    /*
     * PRIORITY
     */

    const priorityOrder = {
      high: 0,
      medium: 1,
      low: 2,
    };

    insights.sort(
      (a, b) =>
        priorityOrder[a.priority] -
        priorityOrder[b.priority],
    );

    const headline =
      insights[0]?.title ||
      "Business is being monitored";

    const summary =
      insights[0]?.message ||
      "Kuba is monitoring your business activity.";

    return NextResponse.json({
      headline,
      summary,
      insights,
      metrics: {
        totalLeads,
        qualifiedLeads,
        conversionRate,
        overdueTasks,
        overdueFollowUps,
        employees,
        successfulAutomations,
      },
      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Analytics insights error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate business insights.",
      },
      {
        status: 500,
      },
    );
  }
}
