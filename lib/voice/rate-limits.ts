import { and, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployeeActivities } from "@/db/schema";
import { getBusinessDayBounds, getBusinessLocalization } from "@/lib/localization";

/**
 * A technical safety limit, not a commercial quota (Phase 39) — counts
 * how many outbound calls this employee has already placed today, in
 * the business's own local day, from the same activity log every call
 * already writes (never a new counter table). Used to enforce the
 * employee's own configured maxDailyCalls (lib/voice/employee-config.ts),
 * which was previously stored but never enforced anywhere.
 */
export async function countTodaysOutboundCalls(businessId: string, employeeId: string): Promise<number> {
  const { start: todayStart } = getBusinessDayBounds((await getBusinessLocalization(businessId)).timezone);
  const rows = await db
    .select({ id: aiEmployeeActivities.id })
    .from(aiEmployeeActivities)
    .where(
      and(
        eq(aiEmployeeActivities.businessId, businessId),
        eq(aiEmployeeActivities.employeeId, employeeId),
        eq(aiEmployeeActivities.type, "voice_call.started"),
        gte(aiEmployeeActivities.createdAt, todayStart),
      ),
    );
  return rows.length;
}
