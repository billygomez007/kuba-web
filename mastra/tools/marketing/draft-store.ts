import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployeeActivities, aiEmployees } from "@/db/schema";

/**
 * Marketing drafts (campaign briefs, content, calendars, nurture sequences,
 * audience plans, experiment plans) are stored using the existing
 * ai_employee_activities table rather than a new "documents" table — see
 * MARKETING_AI_EMPLOYEE_REPORT.md for why no schema change was made.
 */
export async function getActiveMarketingEmployeeId(businessId: string): Promise<string | null> {
  const result = await db
    .select({ id: aiEmployees.id })
    .from(aiEmployees)
    .where(and(eq(aiEmployees.businessId, businessId), eq(aiEmployees.type, "marketing"), eq(aiEmployees.status, "active")))
    .limit(1);

  return result[0]?.id || null;
}

export async function saveMarketingDraft(params: {
  businessId: string;
  type: string;
  title: string;
  draft: Record<string, unknown>;
}): Promise<{ success: true; draftId: string } | { success: false; error: string }> {
  const employeeId = await getActiveMarketingEmployeeId(params.businessId);

  if (!employeeId) {
    return {
      success: false,
      error: "No active Marketing AI employee was found for this business.",
    };
  }

  const draftId = crypto.randomUUID();

  await db.insert(aiEmployeeActivities).values({
    id: draftId,
    businessId: params.businessId,
    employeeId,
    type: params.type,
    title: params.title,
    description: JSON.stringify(params.draft),
    status: "draft",
    createdAt: new Date(),
  });

  return { success: true, draftId };
}
