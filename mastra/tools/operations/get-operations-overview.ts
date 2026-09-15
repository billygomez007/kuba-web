import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, count, eq, gt, lt, ne } from "drizzle-orm";

import { db } from "@/db";
import { appointments, automationRuns, tasks } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

/**
 * Real counts only, from the same tasks/appointments/automationRuns tables
 * every other part of the app already reads — no invented operational
 * metric (throughput, SLA percentage, utilization) that isn't backed by a
 * real stored value.
 */
export const getOperationsOverviewTool = createTool({
  id: "get-operations-overview",

  description:
    "Retrieve real open/overdue task counts, upcoming appointment counts, and recent automation-run status counts for the current business.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_operations_overview" });
    if (!decision.ok) return { available: false, message: decision.message };

    const now = new Date();

    const [openTasks, overdueTasks, upcomingAppointments, automationRunRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(tasks)
        .where(and(eq(tasks.businessId, businessId), ne(tasks.status, "completed"))),
      db
        .select({ total: count() })
        .from(tasks)
        .where(and(eq(tasks.businessId, businessId), ne(tasks.status, "completed"), lt(tasks.dueAt, now))),
      db
        .select({ total: count() })
        .from(appointments)
        .where(and(eq(appointments.businessId, businessId), gt(appointments.startAt, now))),
      db
        .select({ status: automationRuns.status, total: count() })
        .from(automationRuns)
        .where(eq(automationRuns.businessId, businessId))
        .groupBy(automationRuns.status),
    ]);

    return {
      available: true,
      openTasks: Number(openTasks[0]?.total ?? 0),
      overdueTasks: Number(overdueTasks[0]?.total ?? 0),
      upcomingAppointments: Number(upcomingAppointments[0]?.total ?? 0),
      automationRunsByStatus: Object.fromEntries(automationRunRows.map((row) => [row.status, Number(row.total)])),
      note: "Real counts only. No throughput, SLA, or utilization metric is fabricated.",
    };
  },
});
