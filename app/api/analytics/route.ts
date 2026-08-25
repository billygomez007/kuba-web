import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  and,
  count,
  eq,
  gt,
  lt,
  sql,
} from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  customers,
  leads,
  followUps,
  tasks,
  salesActivities,
  aiEmployees,
  aiEmployeeActivities,
  automations,
  automationRuns,
  conversations,
} from "@/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
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
        { error: "Business not found." },
        { status: 404 },
      );
    }

    const businessId =
      business.businessId;

    const now = new Date();

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    /*
     * Load the actual leads once.
     *
     * This gives Analytics access to:
     * stage
     * estimatedValue
     * currency
     * dealStatus
     * source
     * assignedEmployeeId
     */
    const allLeads =
      await db
        .select({
          id: leads.id,
          stage: leads.stage,
          estimatedValue:
            leads.estimatedValue,
          currency: leads.currency,
          dealStatus:
            leads.dealStatus,
          source: leads.source,
          assignedEmployeeId:
            leads.assignedEmployeeId,
        })
        .from(leads)
        .where(
          eq(
            leads.businessId,
            businessId,
          ),
        );

    /*
     * General business metrics.
     */
    const [
      customerCount,
      newCustomers,
      newLeads,
      completedTasks,
      pendingTasks,
      overdueTasks,
      pendingFollowUps,
      overdueFollowUps,
      salesActivityCount,
      employeeCount,
      employeeActivityCount,
      automationCount,
      automationRunCount,
      successfulAutomationRuns,
      conversationCount,
      openConversations,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(customers)
        .where(
          eq(
            customers.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
        .from(customers)
        .where(
          and(
            eq(
              customers.businessId,
              businessId,
            ),
            gt(
              customers.createdAt,
              monthStart,
            ),
          ),
        ),

      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(
              leads.businessId,
              businessId,
            ),
            gt(
              leads.createdAt,
              monthStart,
            ),
          ),
        ),

      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(
              tasks.businessId,
              businessId,
            ),
            eq(
              tasks.status,
              "completed",
            ),
          ),
        ),

      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(
              tasks.businessId,
              businessId,
            ),
            sql`LOWER(${tasks.status}) != 'completed'`,
          ),
        ),

      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(
              tasks.businessId,
              businessId,
            ),
            lt(
              tasks.dueAt,
              now,
            ),
            sql`LOWER(${tasks.status}) != 'completed'`,
          ),
        ),

      db
        .select({ count: count() })
        .from(followUps)
        .where(
          and(
            eq(
              followUps.businessId,
              businessId,
            ),
            sql`LOWER(${followUps.status}) != 'completed'`,
          ),
        ),

      db
        .select({ count: count() })
        .from(followUps)
        .where(
          and(
            eq(
              followUps.businessId,
              businessId,
            ),
            lt(
              followUps.dueAt,
              now,
            ),
            sql`LOWER(${followUps.status}) != 'completed'`,
          ),
        ),

      db
        .select({ count: count() })
        .from(salesActivities)
        .where(
          eq(
            salesActivities.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
        .from(aiEmployees)
        .where(
          eq(
            aiEmployees.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
        .from(aiEmployeeActivities)
        .where(
          eq(
            aiEmployeeActivities.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
        .from(automations)
        .where(
          eq(
            automations.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
        .from(automationRuns)
        .where(
          eq(
            automationRuns.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
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

      db
        .select({ count: count() })
        .from(conversations)
        .where(
          eq(
            conversations.businessId,
            businessId,
          ),
        ),

      db
        .select({ count: count() })
        .from(conversations)
        .where(
          and(
            eq(
              conversations.businessId,
              businessId,
            ),
            sql`LOWER(${conversations.status}) = 'open'`,
          ),
        ),
    ]);

    /*
     * SALES PIPELINE
     */

    const pipelineMap =
      new Map<
        string,
        number
      >();

    const pipelineValueMap =
      new Map<
        string,
        number
      >();

    const sourceMap =
      new Map<
        string,
        number
      >();

    const employeeMap =
      new Map<
        string,
        number
      >();

    let pipelineValue = 0;

    let wonValue = 0;
    let openValue = 0;
    let lostValue = 0;

    let wonDeals = 0;
    let openDeals = 0;
    let lostDeals = 0;

    for (const lead of allLeads) {
      const stage =
        String(
          lead.stage ||
            "new",
        )
          .trim()
          .toLowerCase();

      const stageLabel =
        stage || "new";

      pipelineMap.set(
        stageLabel,
        (pipelineMap.get(
          stageLabel,
        ) || 0) + 1,
      );

      const value =
        Number(
          String(
            lead.estimatedValue ||
              "0",
          ).replace(
            /[^0-9.-]/g,
            "",
          ),
        ) || 0;

      pipelineValue += value;

      pipelineValueMap.set(
        stageLabel,
        (pipelineValueMap.get(
          stageLabel,
        ) || 0) + value,
      );

      const dealStatus =
        String(
          lead.dealStatus ||
            "open",
        )
          .trim()
          .toLowerCase();

      if (
        dealStatus === "won" ||
        dealStatus === "closed_won"
      ) {
        wonDeals += 1;
        wonValue += value;
      } else if (
        dealStatus === "lost" ||
        dealStatus === "closed_lost"
      ) {
        lostDeals += 1;
        lostValue += value;
      } else {
        openDeals += 1;
        openValue += value;
      }

      const source =
        String(
          lead.source ||
            "unknown",
        ).trim();

      const sourceKey =
        source || "Unknown";

      sourceMap.set(
        sourceKey,
        (sourceMap.get(
          sourceKey,
        ) || 0) + 1,
      );

      if (
        lead.assignedEmployeeId
      ) {
        employeeMap.set(
          lead.assignedEmployeeId,
          (employeeMap.get(
            lead.assignedEmployeeId,
          ) || 0) + 1,
        );
      }
    }

    const pipeline =
      Array.from(
        pipelineMap.entries(),
      )
        .map(
          ([
            stage,
            count,
          ]) => ({
            stage,
            count,
            value:
              pipelineValueMap.get(
                stage,
              ) || 0,
          }),
        )
        .sort(
          (a, b) =>
            b.count - a.count,
        );

    const leadSources =
      Array.from(
        sourceMap.entries(),
      )
        .map(
          ([
            source,
            count,
          ]) => ({
            source,
            count,
            percentage:
              allLeads.length > 0
                ? Number(
                    (
                      (count /
                        allLeads.length) *
                      100
                    ).toFixed(1),
                  )
                : 0,
          }),
        )
        .sort(
          (a, b) =>
            b.count - a.count,
        );

    const employeeLeads =
      Array.from(
        employeeMap.entries(),
      )
        .map(
          ([
            employeeId,
            count,
          ]) => ({
            employeeId,
            count,
          }),
        )
        .sort(
          (a, b) =>
            b.count - a.count,
        );

    const totalLeads =
      allLeads.length;

    const qualified =
      allLeads.filter(
        (lead) =>
          String(
            lead.stage || "",
          ).toLowerCase() ===
          "qualified",
      ).length;

    const conversionRate =
      totalLeads > 0
        ? Number(
            (
              (qualified /
                totalLeads) *
              100
            ).toFixed(1),
          )
        : 0;

    const totalAutomationRuns =
      Number(
        automationRunCount[0]?.count ||
          0,
      );

    const successfulRuns =
      Number(
        successfulAutomationRuns[0]?.count ||
          0,
      );

    const automationSuccessRate =
      totalAutomationRuns > 0
        ? Number(
            (
              (successfulRuns /
                totalAutomationRuns) *
              100
            ).toFixed(1),
          )
        : 0;

    return NextResponse.json({
      overview: {
        customers:
          Number(
            customerCount[0]?.count ||
              0,
          ),

        newCustomers:
          Number(
            newCustomers[0]?.count ||
              0,
          ),

        leads:
          totalLeads,

        newLeads:
          Number(
            newLeads[0]?.count ||
              0,
          ),

        qualifiedLeads:
          qualified,

        conversionRate,

        completedTasks:
          Number(
            completedTasks[0]?.count ||
              0,
          ),

        pendingTasks:
          Number(
            pendingTasks[0]?.count ||
              0,
          ),

        overdueTasks:
          Number(
            overdueTasks[0]?.count ||
              0,
          ),

        pendingFollowUps:
          Number(
            pendingFollowUps[0]?.count ||
              0,
          ),

        overdueFollowUps:
          Number(
            overdueFollowUps[0]?.count ||
              0,
          ),
      },

      sales: {
        activities:
          Number(
            salesActivityCount[0]?.count ||
              0,
          ),

        pipeline,

        pipelineValue,

        dealStatus: {
          open: openDeals,
          won: wonDeals,
          lost: lostDeals,

          openValue,
          wonValue,
          lostValue,
        },

        leadSources,

        employeeLeads,
      },

      workforce: {
        employees:
          Number(
            employeeCount[0]?.count ||
              0,
          ),

        activities:
          Number(
            employeeActivityCount[0]?.count ||
              0,
          ),
      },

      automations: {
        total:
          Number(
            automationCount[0]?.count ||
              0,
          ),

        runs:
          totalAutomationRuns,

        successfulRuns,

        successRate:
          automationSuccessRate,
      },

      communications: {
        conversations:
          Number(
            conversationCount[0]?.count ||
              0,
          ),

        openConversations:
          Number(
            openConversations[0]?.count ||
              0,
          ),
      },

      generatedAt:
        now.toISOString(),
    });
  } catch (error) {
    console.error(
      "Analytics API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load analytics.",
      },
      {
        status: 500,
      },
    );
  }
}
