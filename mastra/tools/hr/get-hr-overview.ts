import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { hrDepartments, hrEmployees, hrLeaveRequests } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

/**
 * Deliberately headcount/status-shaped, never compensation or protected-
 * characteristic data — Kuba HR reads real hrEmployees/hrDepartments/
 * hrLeaveRequests rows already maintained by the existing Human Workforce
 * module, grouped only by employmentStatus/leave status, never individual
 * pay or demographic fields.
 */
export const getHrOverviewTool = createTool({
  id: "get-hr-overview",

  description:
    "Retrieve real headcount, department, and pending-leave-request counts for the current business. Never returns compensation or protected-characteristic data.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_hr_overview" });
    if (!decision.ok) return { available: false, message: decision.message };

    const [activeCount, departments, pendingLeave] = await Promise.all([
      db
        .select({ total: count() })
        .from(hrEmployees)
        .where(eq(hrEmployees.businessId, businessId)),
      db
        .select({ id: hrDepartments.id, name: hrDepartments.name, status: hrDepartments.status })
        .from(hrDepartments)
        .where(eq(hrDepartments.businessId, businessId)),
      db
        .select({ status: hrLeaveRequests.status, total: count() })
        .from(hrLeaveRequests)
        .where(eq(hrLeaveRequests.businessId, businessId))
        .groupBy(hrLeaveRequests.status),
    ]);

    if (activeCount[0]?.total === 0 && departments.length === 0) {
      return {
        available: false,
        message: "No HR records (employees or departments) have been set up for this business yet.",
      };
    }

    return {
      available: true,
      totalHrEmployees: Number(activeCount[0]?.total ?? 0),
      departments: departments.map((d) => ({ id: d.id, name: d.name, status: d.status })),
      leaveRequestsByStatus: Object.fromEntries(pendingLeave.map((row) => [row.status, Number(row.total)])),
      note: "Counts only. No compensation, performance, or protected-characteristic data is included.",
    };
  },
});
