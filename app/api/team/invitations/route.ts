import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessInvitations,
} from "@/db/schema";

import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
  isBusinessRole,
} from "@/lib/auth/permissions";

import {
  createAuditLog,
} from "@/lib/auth/audit";

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
        { error: "Business access denied." },
        { status: 403 },
      );
    }

    const allowed =
      hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_VIEW,
      );

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view team invitations.",
        },
        { status: 403 },
      );
    }

    const invitations =
      await db
        .select({
          id: businessInvitations.id,
          email: businessInvitations.email,
          name: businessInvitations.name,
          role: businessInvitations.role,
          status: businessInvitations.status,
          branchId: businessInvitations.branchId,
          expiresAt: businessInvitations.expiresAt,
          createdAt: businessInvitations.createdAt,
        })
        .from(businessInvitations)
        .where(
          and(
            eq(
              businessInvitations.businessId,
              membership.businessId,
            ),
            eq(
              businessInvitations.status,
              "pending",
            ),
          ),
        );

    return NextResponse.json({
      invitations,
    });
  } catch (error) {
    console.error(
      "Load team invitations error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load team invitations.",
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
        { error: "Business access denied." },
        { status: 403 },
      );
    }

    const allowed =
      hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_MANAGE,
      );

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to invite users." },
        { status: 403 },
      );
    }

    const body =
      await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : null;

    const role =
      typeof body.role === "string"
        ? body.role.trim().toLowerCase()
        : "";

    const branchId =
      typeof body.branchId === "string" &&
      body.branchId.trim()
        ? body.branchId.trim()
        : null;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 },
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 },
      );
    }

    if (!isBusinessRole(role)) {
      return NextResponse.json(
        { error: "Invalid business role." },
        { status: 400 },
      );
    }

    if (role === "owner") {
      return NextResponse.json(
        {
          error:
            "The owner role cannot be assigned through an invitation.",
        },
        { status: 400 },
      );
    }

    const existingInvitation =
      await db
        .select({
          id: businessInvitations.id,
        })
        .from(businessInvitations)
        .where(
          and(
            eq(
              businessInvitations.businessId,
              membership.businessId,
            ),
            eq(
              businessInvitations.email,
              email,
            ),
            eq(
              businessInvitations.status,
              "pending",
            ),
          ),
        )
        .limit(1);

    if (existingInvitation.length > 0) {
      return NextResponse.json(
        {
          error:
            "A pending invitation already exists for this email.",
        },
        { status: 409 },
      );
    }

    const token =
      crypto.randomUUID() +
      crypto.randomUUID();

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          7 * 24 * 60 * 60 * 1000,
      );

    const invitationId =
      crypto.randomUUID();

    await db
      .insert(businessInvitations)
      .values({
        id: invitationId,

        businessId:
          membership.businessId,

        email,

        name,

        role,

        permissions: null,

        branchId,

        token,

        invitedByUserId:
          session.user.id,

        status: "pending",

        expiresAt,

        acceptedAt: null,

        createdAt: now,

        updatedAt: now,
      });

    await createAuditLog({
      businessId:
        membership.businessId,

      userId:
        session.user.id,

      action:
        "user.invited",

      resource:
        "business_invitation",

      resourceId:
        invitationId,

      description:
        `Invited ${email} as ${role}.`,

      metadata: {
        email,
        role,
        branchId,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://superkuba.com"
        : "http://localhost:3000");

    const invitationUrl =
      `${baseUrl}/invite?token=${encodeURIComponent(token)}`;

    return NextResponse.json(
      {
        success: true,

        invitation: {
          id: invitationId,
          email,
          role,
          expiresAt,
          token,
          invitationUrl,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Create team invitation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create invitation.",
      },
      { status: 500 },
    );
  }
}
