import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessTeams,
} from "@/db/schema";

import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

export async function GET() {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const membership =
      await getBusinessMembership(
        session.user.id,
      );

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Business access denied.",
        },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_VIEW,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Permission denied.",
        },
        { status: 403 },
      );
    }

    const teams =
      await db
        .select()
        .from(businessTeams)
        .where(
          eq(
            businessTeams.businessId,
            membership.businessId,
          ),
        );

    return NextResponse.json({
      success: true,
      teams,
    });
  } catch (error) {
    console.error(
      "Load teams error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load teams.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const membership =
      await getBusinessMembership(
        session.user.id,
      );

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Business access denied.",
        },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_MANAGE,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Permission denied.",
        },
        { status: 403 },
      );
    }

    const body =
      await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const department =
      typeof body.department === "string"
        ? body.department.trim().toLowerCase()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Team name is required.",
        },
        { status: 400 },
      );
    }

    if (!department) {
      return NextResponse.json(
        {
          error:
            "Team department is required.",
        },
        { status: 400 },
      );
    }

    const now =
      new Date();

    const team = {
      id: crypto.randomUUID(),

      businessId:
        membership.businessId,

      department,

      name,

      description,

      status: "active",

      createdAt: now,

      updatedAt: now,
    };

    await db
      .insert(businessTeams)
      .values(team);

    return NextResponse.json(
      {
        success: true,
        team,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Create team error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create team.",
      },
      { status: 500 },
    );
  }
}
