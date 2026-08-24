import { and, desc, eq, count, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiEmployees,
  conversations,
  handoffs,
  aiEmployeeActivities,
  users,
  leads,
  followUps,
  tasks,
  knowledgeSources,
  aiBusinessSettings,
} from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const {
      user,
      membership,
      error,
    } =
      await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        {
          error:
            error || "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            error ||
            "Business access denied.",
        },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.WORKFORCE_VIEW,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view AI workforce data.",
        },
        { status: 403 },
      );
    }

    const { id } =
      await context.params;

    const employeeResult =
      await db
        .select({
          employee: aiEmployees,
          supervisorName:
            users.name,
        })
        .from(aiEmployees)
        .leftJoin(
          users,
          eq(
            users.id,
            aiEmployees.supervisorUserId,
          ),
        )
        .where(
          and(
            eq(
              aiEmployees.id,
              id,
            ),
            eq(
              aiEmployees.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    const employee =
      employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "AI employee not found.",
        },
        { status: 404 },
      );
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const conversationCount =
      await db
        .select({
          total: count(),
        })
        .from(conversations)
        .where(
          and(
            eq(
              conversations.assignedEmployeeId,
              id,
            ),
            eq(
              conversations.businessId,
              membership.businessId,
            ),
          ),
        );

    const handoffCount =
      await db
        .select({
          total: count(),
        })
        .from(handoffs)
        .where(
          and(
            eq(
              handoffs.fromEmployeeId,
              id,
            ),
            eq(
              handoffs.businessId,
              membership.businessId,
            ),
          ),
        );

    const activities =
      await db
        .select()
        .from(aiEmployeeActivities)
        .where(
          and(
            eq(
              aiEmployeeActivities.employeeId,
              id,
            ),
            eq(
              aiEmployeeActivities.businessId,
              membership.businessId,
            ),
          ),
        )
        .orderBy(desc(aiEmployeeActivities.createdAt))
        .limit(10);

    const [todayConversationCount, leadData, followUpData, taskData, knowledgeData, businessSettings] = await Promise.all([
      db
        .select({ total: count() })
        .from(conversations)
        .where(
          and(
            eq(conversations.assignedEmployeeId, id),
            eq(conversations.businessId, membership.businessId),
            gte(conversations.updatedAt, startOfDay),
          ),
        ),
      db
        .select({
          id: leads.id,
          notes: leads.notes,
          stage: leads.stage,
        })
        .from(leads)
        .where(
          and(
            eq(leads.assignedEmployeeId, id),
            eq(leads.businessId, membership.businessId),
          ),
        ),
      db
        .select({ id: followUps.id })
        .from(followUps)
        .where(
          and(
            eq(followUps.assignedEmployeeId, id),
            eq(followUps.businessId, membership.businessId),
          ),
        ),
      db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.assignedEmployeeId, id),
            eq(tasks.businessId, membership.businessId),
            eq(tasks.status, "completed"),
          ),
        ),
      db
        .select({
          id: knowledgeSources.id,
          name: knowledgeSources.name,
          status: knowledgeSources.status,
          fileType: knowledgeSources.fileType,
          employeeId: knowledgeSources.employeeId,
        })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.businessId, membership.businessId),
          ),
        ),
      db
        .select({
          businessDescription: aiBusinessSettings.businessDescription,
          frequentlyAskedQuestions: aiBusinessSettings.frequentlyAskedQuestions,
        })
        .from(aiBusinessSettings)
        .where(eq(aiBusinessSettings.businessId, membership.businessId))
        .limit(1),
    ]);

    const totalConversations = conversationCount[0]?.total || 0;
    const resolvedConversations = await db
      .select({ total: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.assignedEmployeeId, id),
          eq(conversations.businessId, membership.businessId),
          eq(conversations.status, "resolved"),
        ),
      );

    const successRate = totalConversations > 0
      ? Math.round(((resolvedConversations[0]?.total || 0) / totalConversations) * 100)
      : null;

    const objectionLabels = [
      ["Price", /price|expensive|cost|budget/i],
      ["Delivery time", /delivery|shipping|wait|timeline/i],
      ["Payment options", /payment|financing|installment|credit/i],
    ] as const;

    const salesObjections = objectionLabels
      .map(([label, pattern]) => ({
        label,
        count: leadData.filter(
          (lead) => Boolean(lead.notes && pattern.test(lead.notes)),
        ).length,
      }))
      .filter((item) => item.count > 0)
      .sort((first, second) => second.count - first.count);

    const salesInsights = employee.employee.type === "sales"
      ? {
          conversionRate: leadData.length > 0
            ? Math.round((leadData.filter((lead) => lead.stage === "converted").length / leadData.length) * 100)
            : null,
          objections: salesObjections,
          recommendations: [
            ...(salesObjections.some((item) => item.label === "Price")
              ? ["Add a pricing FAQ"]
              : []),
            ...(salesObjections.some((item) => item.label === "Payment options")
              ? ["Train Sales AI on financing options"]
              : []),
            ...(followUpData.length === 0 && leadData.length > 0
              ? ["Create follow-up automation"]
              : []),
          ],
        }
      : null;

    return NextResponse.json({
      employee: {
        id:
          employee.employee.id,

        name:
          employee.employee.name,

        type:
          employee.employee.type,

        status:
          employee.employee.status,

        supervisionMode:
          employee.employee.supervisionMode,

        supervisor:
          employee.supervisorName ||
          null,
      },

      metrics: {
        conversations:
          conversationCount[0]
            ?.total || 0,

        conversationsToday:
          todayConversationCount[0]?.total || 0,

        leadsCreated: leadData.length,

        tasksCompleted: taskData.length,

        followUpsCreated: followUpData.length,

        handoffs:
          handoffCount[0]
            ?.total || 0,

        successRate,
      },

      salesInsights,

      activities,

      knowledge: {
        sources: knowledgeData,
        sourceCount: knowledgeData.length,
        documentsUploaded: knowledgeData.filter(
          (source) => source.status === "ready" || source.status === "completed",
        ).length,
        faqsAvailable: Boolean(
          businessSettings[0]?.frequentlyAskedQuestions,
        ),
        businessInformationAvailable: Boolean(
          businessSettings[0]?.businessDescription,
        ),
      },
    });
  } catch (error) {
    console.error(
      "Employee dashboard error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load employee dashboard.",
      },
      { status: 500 },
    );
  }
}
