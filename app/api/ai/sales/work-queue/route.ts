import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, asc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  aiEmployees,
  leads,
  followUps,
} from "@/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const membership = await db
      .select({
        businessId: businessUsers.businessId,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(businessUsers.businessId, businesses.id),
      )
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const businessId = membership[0]?.businessId;

    if (!businessId) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      );
    }

    const salesEmployee = await db
      .select({
        id: aiEmployees.id,
        name: aiEmployees.name,
        type: aiEmployees.type,
        status: aiEmployees.status,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.businessId, businessId),
          eq(aiEmployees.type, "sales"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const employee = salesEmployee[0];

    if (!employee) {
      return NextResponse.json({
        success: true,
        employee: null,
        leads: [],
        followUps: [],
      });
    }

    const assignedLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.businessId, businessId),
          eq(leads.assignedEmployeeId, employee.id),
        ),
      )
      .orderBy(asc(leads.updatedAt));

    const assignedFollowUps = await db
      .select()
      .from(followUps)
      .where(
        and(
          eq(followUps.businessId, businessId),
          eq(followUps.assignedEmployeeId, employee.id),
          eq(followUps.status, "pending"),
        ),
      )
      .orderBy(asc(followUps.dueAt));

    return NextResponse.json({
      success: true,
      employee,
      leads: assignedLeads,
      followUps: assignedFollowUps,
    });
  } catch (error) {
    console.error("Sales work queue error:", error);

    return NextResponse.json(
      { error: "Unable to load the Sales AI work queue." },
      { status: 500 },
    );
  }
}
