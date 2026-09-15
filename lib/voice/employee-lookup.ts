import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployeeSettings, aiEmployees } from "@/db/schema";

/**
 * The one shared "resolve an active employee, scoped to its own
 * business, with its settings" lookup — used by every voice code path
 * that needs it (the existing /api/voice/calls actions, and the new
 * Voice Gateway internal endpoints) so the tenant-scoping WHERE clause
 * is written exactly once.
 */
export async function getActiveEmployee(businessId: string, employeeId: string) {
  return (
    await db
      .select({ employee: aiEmployees, settings: aiEmployeeSettings })
      .from(aiEmployees)
      .leftJoin(aiEmployeeSettings, eq(aiEmployeeSettings.employeeId, aiEmployees.id))
      .where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, businessId), eq(aiEmployees.status, "active")))
      .limit(1)
  )[0];
}
