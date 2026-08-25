import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiEmployees,
  aiEmployeeTeams,
  branches,
  businessTeamMembers,
  businessTeams,
  businessUsers,
  hrAttendanceCorrections,
  hrAttendancePolicies,
  hrAttendanceRecords,
  hrContracts,
  hrDepartments,
  hrEmployeeDocuments,
  hrEmployees,
  hrLeaveBalances,
  hrLeaveRequests,
  hrLeaveTypes,
  hrPositions,
  hrWorkSchedules,
  payrollEmployeeCompensationProfiles,
  payrollJurisdictionSettings,
  payrollPayslips,
  payrollPeriods,
  payrollRuns,
  payrollSalaryStructures,
  users,
} from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { getEffectivePermissions, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { canViewPayroll } from "@/lib/human-workforce/policy";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business access denied." }, { status: 403 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const businessId = membership.businessId;
    const entitlements = await getBusinessEntitlements(businessId);
    if (!hasCapability(entitlements, "human_workforce.core")) {
      return NextResponse.json({ error: "Human Workforce requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 30);

    const [employees, departments, positions, contracts, documents, attendance, corrections, policies, schedules, leaveTypes, leaveBalances, leaveRequests, teams, branchRows] = await Promise.all([
      db.select().from(hrEmployees).where(eq(hrEmployees.businessId, businessId)),
      db.select().from(hrDepartments).where(eq(hrDepartments.businessId, businessId)),
      db.select().from(hrPositions).where(eq(hrPositions.businessId, businessId)),
      db.select().from(hrContracts).where(eq(hrContracts.businessId, businessId)),
      db.select().from(hrEmployeeDocuments).where(eq(hrEmployeeDocuments.businessId, businessId)),
      db.select().from(hrAttendanceRecords).where(and(eq(hrAttendanceRecords.businessId, businessId), gte(hrAttendanceRecords.workDate, today), lte(hrAttendanceRecords.workDate, tomorrow))),
      db.select().from(hrAttendanceCorrections).where(eq(hrAttendanceCorrections.businessId, businessId)),
      db.select().from(hrAttendancePolicies).where(eq(hrAttendancePolicies.businessId, businessId)),
      db.select().from(hrWorkSchedules).where(eq(hrWorkSchedules.businessId, businessId)),
      db.select().from(hrLeaveTypes).where(eq(hrLeaveTypes.businessId, businessId)),
      db.select().from(hrLeaveBalances).where(eq(hrLeaveBalances.businessId, businessId)),
      db.select().from(hrLeaveRequests).where(eq(hrLeaveRequests.businessId, businessId)),
      db.select().from(businessTeams).where(eq(businessTeams.businessId, businessId)),
      db.select().from(branches).where(eq(branches.businessId, businessId)),
    ]);

    const teamIds = teams.map((team) => team.id);
    const [humanTeamRows, aiTeamRows] = teamIds.length
      ? await Promise.all([
          db.select({ teamId: businessTeamMembers.teamId, businessUserId: businessTeamMembers.businessUserId, name: users.name, email: users.email })
            .from(businessTeamMembers)
            .innerJoin(businessUsers, eq(businessUsers.id, businessTeamMembers.businessUserId))
            .innerJoin(users, eq(users.id, businessUsers.userId))
            .where(and(inArray(businessTeamMembers.teamId, teamIds), eq(businessUsers.businessId, businessId))),
          db.select({ teamId: aiEmployeeTeams.teamId, id: aiEmployees.id, name: aiEmployees.name, status: aiEmployees.status, type: aiEmployees.type })
            .from(aiEmployeeTeams)
            .innerJoin(aiEmployees, eq(aiEmployees.id, aiEmployeeTeams.aiEmployeeId))
            .where(and(inArray(aiEmployeeTeams.teamId, teamIds), eq(aiEmployees.businessId, businessId))),
        ])
      : [[], []];

    const effectivePermissions = getEffectivePermissions(membership.role, membership.permissions);
    const payrollAllowed = canViewPayroll(membership.role, effectivePermissions);
    const payroll = payrollAllowed
      ? await Promise.all([
          db.select().from(payrollPeriods).where(eq(payrollPeriods.businessId, businessId)),
          db.select().from(payrollRuns).where(eq(payrollRuns.businessId, businessId)),
          db.select({ id: payrollEmployeeCompensationProfiles.id, employeeId: payrollEmployeeCompensationProfiles.employeeId, salaryStructureId: payrollEmployeeCompensationProfiles.salaryStructureId, effectiveFrom: payrollEmployeeCompensationProfiles.effectiveFrom, effectiveTo: payrollEmployeeCompensationProfiles.effectiveTo, status: payrollEmployeeCompensationProfiles.status }).from(payrollEmployeeCompensationProfiles).where(eq(payrollEmployeeCompensationProfiles.businessId, businessId)),
          db.select().from(payrollSalaryStructures).where(eq(payrollSalaryStructures.businessId, businessId)),
          db.select().from(payrollPayslips).where(eq(payrollPayslips.businessId, businessId)),
          db.select().from(payrollJurisdictionSettings).where(eq(payrollJurisdictionSettings.businessId, businessId)),
        ])
      : null;

    const activeLeave = leaveRequests.filter((request) => request.status === "approved" && request.startDate <= tomorrow && request.endDate >= today);
    return NextResponse.json({
      access: { payroll: payrollAllowed, payrollMode: "read_only" },
      metrics: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((employee) => employee.employmentStatus === "active").length,
        departments: departments.filter((department) => department.status === "active").length,
        operationalTeams: teams.filter((team) => team.status === "active").length,
        employeesOnLeave: new Set(activeLeave.map((request) => request.employeeId)).size,
        attendanceToday: attendance.length,
        pendingLeaveRequests: leaveRequests.filter((request) => ["pending", "submitted"].includes(request.status)).length,
        contractsExpiringSoon: contracts.filter((contract) => contract.status === "active" && contract.endDate && contract.endDate >= today && contract.endDate <= soon).length,
      },
      employees,
      departments,
      positions,
      contracts,
      documents: documents.map((document) => ({
        id: document.id,
        employeeId: document.employeeId,
        contractId: document.contractId,
        documentType: document.documentType,
        title: document.title,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        visibility: document.visibility,
        status: document.status,
        expiresAt: document.expiresAt,
        createdAt: document.createdAt,
      })),
      attendance,
      corrections,
      policies,
      schedules,
      leaveTypes,
      leaveBalances,
      leaveRequests: leaveRequests.map((request) => ({
        id: request.id,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        startDate: request.startDate,
        endDate: request.endDate,
        startSegment: request.startSegment,
        endSegment: request.endSegment,
        requestedMinutes: request.requestedMinutes,
        status: request.status,
        submittedAt: request.submittedAt,
        decidedAt: request.decidedAt,
        cancelledAt: request.cancelledAt,
      })),
      branches: branchRows,
      teams: teams.map((team) => ({ ...team, humanMembers: humanTeamRows.filter((row) => row.teamId === team.id), aiEmployees: aiTeamRows.filter((row) => row.teamId === team.id) })),
      payroll: payroll ? {
        periods: payroll[0],
        runs: payroll[1],
        compensationProfiles: payroll[2],
        salaryStructures: payroll[3],
        payslips: payroll[4].map((payslip) => ({
          id: payslip.id,
          payrollRunId: payslip.payrollRunId,
          payrollPeriodId: payslip.payrollPeriodId,
          employeeId: payslip.employeeId,
          documentNumber: payslip.documentNumber,
          status: payslip.status,
          generatedAt: payslip.generatedAt,
          publishedAt: payslip.publishedAt,
        })),
        jurisdictions: payroll[5],
      } : null,
    });
  } catch (error) {
    console.error("Human Workforce GET failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to load Human Workforce." }, { status: 500 });
  }
}
