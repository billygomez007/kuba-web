import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  aiEmployeeTeams,
  aiEmployees,
  businessTeams,
} from "@/db/schema";

import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

async function getAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const membership =
    await getBusinessMembership(session.user.id);

  if (!membership) return null;

  if (
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.WORKFORCE_MANAGE,
    )
  ) {
    return null;
  }

  return membership;
}


export async function GET() {
  try {
    const membership = await getAccess();

    if (!membership) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const assignments = await db
      .select({
        teamId: aiEmployeeTeams.teamId,
        aiEmployeeId:
          aiEmployeeTeams.aiEmployeeId,
      })
      .from(aiEmployeeTeams)
      .innerJoin(
        businessTeams,
        eq(
          aiEmployeeTeams.teamId,
          businessTeams.id,
        ),
      )
      .where(
        eq(
          businessTeams.businessId,
          membership.businessId,
        ),
      );

    return NextResponse.json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error(
      "Load AI team assignments error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load AI team assignments.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const membership = await getAccess();

    if (!membership) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const teamId =
      typeof body.teamId === "string"
        ? body.teamId.trim()
        : "";

    const aiEmployeeId =
      typeof body.aiEmployeeId === "string"
        ? body.aiEmployeeId.trim()
        : "";

    if (!teamId || !aiEmployeeId) {
      return NextResponse.json(
        {
          error:
            "teamId and aiEmployeeId are required.",
        },
        { status: 400 },
      );
    }

    const team = await db
      .select({ id: businessTeams.id })
      .from(businessTeams)
      .where(
        and(
          eq(businessTeams.id, teamId),
          eq(
            businessTeams.businessId,
            membership.businessId,
          ),
        ),
      )
      .limit(1);

    if (!team[0]) {
      return NextResponse.json(
        { error: "Team not found." },
        { status: 404 },
      );
    }

    const employee = await db
      .select({
        id: aiEmployees.id,
        businessId: aiEmployees.businessId,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.id, aiEmployeeId),
          eq(
            aiEmployees.businessId,
            membership.businessId,
          ),
        ),
      )
      .limit(1);

    if (!employee[0]) {
      return NextResponse.json(
        { error: "AI employee not found." },
        { status: 404 },
      );
    }

    const existing = await db
      .select({ id: aiEmployeeTeams.id })
      .from(aiEmployeeTeams)
      .where(
        and(
          eq(
            aiEmployeeTeams.teamId,
            teamId,
          ),
          eq(
            aiEmployeeTeams.aiEmployeeId,
            aiEmployeeId,
          ),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({
        success: true,
        alreadyAssigned: true,
      });
    }

    await db.insert(aiEmployeeTeams).values({
      id: crypto.randomUUID(),
      teamId,
      aiEmployeeId,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Assign AI employee error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to assign AI employee.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const membership = await getAccess();

    if (!membership) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const teamId =
      typeof body.teamId === "string"
        ? body.teamId.trim()
        : "";

    const aiEmployeeId =
      typeof body.aiEmployeeId === "string"
        ? body.aiEmployeeId.trim()
        : "";

    if (!teamId || !aiEmployeeId) {
      return NextResponse.json(
        {
          error:
            "teamId and aiEmployeeId are required.",
        },
        { status: 400 },
      );
    }

    await db
      .delete(aiEmployeeTeams)
      .where(
        and(
          eq(
            aiEmployeeTeams.teamId,
            teamId,
          ),
          eq(
            aiEmployeeTeams.aiEmployeeId,
            aiEmployeeId,
          ),
        ),
      );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Remove AI employee from team error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to remove AI employee.",
      },
      { status: 500 },
    );
  }
}
