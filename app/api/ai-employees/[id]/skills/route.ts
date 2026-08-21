import { and, eq, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees, employeeSkills, skills } from "@/db/schema";
import { authorizationErrorResponse, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validId, validationErrorResponse } from "@/lib/api/validation";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authorization = await requirePermission(PERMISSIONS.WORKFORCE_VIEW, request);
    const { id } = await context.params;
    const employeeId = validId(id, "Employee ID");
    const employee = (await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, authorization.business.id))).limit(1))[0];
    if (!employee) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });

    const installedSkills = await db.select({ id: skills.id, name: skills.name, slug: skills.slug, category: skills.category, description: skills.description, installedAt: employeeSkills.installedAt }).from(employeeSkills).innerJoin(skills, eq(employeeSkills.skillId, skills.id)).where(eq(employeeSkills.employeeId, employeeId));
    const installedIds = installedSkills.map((skill) => skill.id);
    const availableSkills = installedIds.length ? await db.select().from(skills).where(notInArray(skills.id, installedIds)) : await db.select().from(skills);
    return NextResponse.json({ installedSkills, availableSkills });
  } catch (error) {
    return authorizationErrorResponse(error) ?? validationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load employee skills." }, { status: 500 });
  }
}
