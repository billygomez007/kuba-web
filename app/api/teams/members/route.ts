import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessTeams,
  businessTeamMembers,
  businessUsers,
} from "@/db/schema";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

async function getAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const membership = await getCurrentMembership();

  if (!membership) return null;

  if (
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.USERS_MANAGE,
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

    const memberships = await db
      .select({
        teamId: businessTeamMembers.teamId,
        businessUserId:
          businessTeamMembers.businessUserId,
      })
      .from(businessTeamMembers)
      .innerJoin(
        businessTeams,
        eq(
          businessTeamMembers.teamId,
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
      memberships,
    });
  } catch (error) {
    console.error(
      "Load team members error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load team members.",
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

    const businessUserId =
      typeof body.businessUserId === "string"
        ? body.businessUserId.trim()
        : "";

    if (!teamId || !businessUserId) {
      return NextResponse.json(
        {
          error:
            "teamId and businessUserId are required.",
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

    const user = await db
      .select({ id: businessUsers.id })
      .from(businessUsers)
      .where(
        and(
          eq(
            businessUsers.id,
            businessUserId,
          ),
          eq(
            businessUsers.businessId,
            membership.businessId,
          ),
        ),
      )
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: "Team member not found." },
        { status: 404 },
      );
    }

    const existing = await db
      .select({ id: businessTeamMembers.id })
      .from(businessTeamMembers)
      .where(
        and(
          eq(
            businessTeamMembers.teamId,
            teamId,
          ),
          eq(
            businessTeamMembers.businessUserId,
            businessUserId,
          ),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
      });
    }

    await db.insert(businessTeamMembers).values({
      id: crypto.randomUUID(),
      teamId,
      businessUserId,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Add team member error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to add team member.",
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

    const businessUserId =
      typeof body.businessUserId === "string"
        ? body.businessUserId.trim()
        : "";

    if (!teamId || !businessUserId) {
      return NextResponse.json(
        {
          error:
            "teamId and businessUserId are required.",
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

    const user = await db
      .select({ id: businessUsers.id })
      .from(businessUsers)
      .where(
        and(
          eq(
            businessUsers.id,
            businessUserId,
          ),
          eq(
            businessUsers.businessId,
            membership.businessId,
          ),
        ),
      )
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: "Team member not found." },
        { status: 404 },
      );
    }

    await db
      .delete(businessTeamMembers)
      .where(
        and(
          eq(
            businessTeamMembers.teamId,
            teamId,
          ),
          eq(
            businessTeamMembers.businessUserId,
            businessUserId,
          ),
        ),
      );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Remove team member error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to remove team member.",
      },
      { status: 500 },
    );
  }
}
