import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import {
  hrAttendanceRecords,
  hrDepartments,
  hrEmployees,
  hrLeaveRequests,
} from "@/db/schema";

function topCounts(values: string[], limit = 8) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

// Deliberately excludes salary/compensation, leave reason, and emergency
// contact fields — this endpoint aggregates safe, non-sensitive HR counts
// only. See PHASE 9 of the Intelligence brief.
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    if (
      !hasPermission(business.role, business.permissions, PERMISSIONS.ANALYTICS_VIEW) ||
      !hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "intelligence.human_workforce")) {
      return NextResponse.json({ error: "Human Workforce Analytics requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const businessId = business.businessId;

    const [employeeRows, departmentRows, attendanceRows, leaveRows] = await Promise.all([
      db.select({ id: hrEmployees.id, departmentId: hrEmployees.departmentId, employmentType: hrEmployees.employmentType, employmentStatus: hrEmployees.employmentStatus, hireDate: hrEmployees.hireDate }).from(hrEmployees).where(eq(hrEmployees.businessId, businessId)),
      db.select({ id: hrDepartments.id, name: hrDepartments.name, status: hrDepartments.status }).from(hrDepartments).where(eq(hrDepartments.businessId, businessId)),
      db.select({ id: hrAttendanceRecords.id, status: hrAttendanceRecords.status, workDate: hrAttendanceRecords.workDate }).from(hrAttendanceRecords).where(eq(hrAttendanceRecords.businessId, businessId)),
      db.select({ id: hrLeaveRequests.id, status: hrLeaveRequests.status, startDate: hrLeaveRequests.startDate }).from(hrLeaveRequests).where(eq(hrLeaveRequests.businessId, businessId)),
    ]);

    const departmentNameById = new Map(departmentRows.map((department) => [department.id, department.name]));
    const activeEmployees = employeeRows.filter((employee) => employee.employmentStatus === "active");
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const recentAttendance = attendanceRows.filter((record) => record.workDate.getTime() >= thirtyDaysAgo);
    const recentLeave = leaveRows.filter((request) => request.startDate.getTime() >= thirtyDaysAgo);

    return NextResponse.json({
      headcount: {
        total: employeeRows.length,
        active: activeEmployees.length,
        byStatus: topCounts(employeeRows.map((employee) => employee.employmentStatus)),
        byEmploymentType: topCounts(employeeRows.map((employee) => employee.employmentType)),
        byDepartment: topCounts(activeEmployees.map((employee) => (employee.departmentId ? departmentNameById.get(employee.departmentId) || "Unassigned" : "Unassigned"))),
      },
      departments: {
        total: departmentRows.length,
        active: departmentRows.filter((department) => department.status === "active").length,
      },
      attendance30d: {
        totalRecords: recentAttendance.length,
        byStatus: topCounts(recentAttendance.map((record) => record.status)),
      },
      leave30d: {
        totalRequests: recentLeave.length,
        pending: recentLeave.filter((request) => request.status === "pending" || request.status === "submitted").length,
        approved: recentLeave.filter((request) => request.status === "approved").length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Human Workforce Analytics error:", error);
    return NextResponse.json({ error: "Unable to load Human Workforce Analytics." }, { status: 500 });
  }
}
