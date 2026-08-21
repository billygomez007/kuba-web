import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees, employeeSkills } from "@/db/schema";
import { authorizationErrorResponse, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { readJsonObject, validId, validationErrorResponse } from "@/lib/api/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authorization = await requirePermission(PERMISSIONS.SKILLS_MANAGE, request);
    const { id } = await context.params;
    const employeeId = validId(id, "Employee ID");
    const body = await readJsonObject(request);
    const skillId = validId(body.skillId, "Skill ID");
    const employee = (await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, authorization.business.id))).limit(1))[0];
    if (!employee) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });

    await db.delete(employeeSkills).where(and(eq(employeeSkills.employeeId, employeeId), eq(employeeSkills.skillId, skillId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return authorizationErrorResponse(error) ?? validationErrorResponse(error) ?? NextResponse.json({ error: "Unable to remove skill." }, { status: 500 });
  }
}
