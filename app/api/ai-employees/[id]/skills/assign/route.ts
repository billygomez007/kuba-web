import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees, employeeSkills, skills } from "@/db/schema";
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

    const [employee, skill] = await Promise.all([
      db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, authorization.business.id))).limit(1),
      db.select({ id: skills.id }).from(skills).where(eq(skills.id, skillId)).limit(1),
    ]);
    if (!employee[0]) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!skill[0]) return NextResponse.json({ error: "Skill not found." }, { status: 404 });

    const now = new Date();
    await db.insert(employeeSkills).values({ id: crypto.randomUUID(), employeeId, skillId, status: "active", installedAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing();
    return NextResponse.json({ success: true });
  } catch (error) {
    return authorizationErrorResponse(error) ?? validationErrorResponse(error) ?? NextResponse.json({ error: "Unable to assign skill." }, { status: 500 });
  }
}
