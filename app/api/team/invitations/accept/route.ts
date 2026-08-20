import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessInvitations,
  businessUsers,
} from "@/db/schema";

import {
  isBusinessRole,
} from "@/lib/auth/permissions";

import {
  createAuditLog,
} from "@/lib/auth/audit";

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

    const body =
      await request.json();

    const token =
      typeof body.token === "string"
        ? body.token.trim()
        : "";

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Invitation token is required.",
        },
        { status: 400 },
      );
    }

    const invitationResult =
      await db
        .select()
        .from(businessInvitations)
        .where(
          and(
            eq(
              businessInvitations.token,
              token,
            ),
            eq(
              businessInvitations.status,
              "pending",
            ),
          ),
        )
        .limit(1);

    const invitation =
      invitationResult[0];

    if (!invitation) {
      return NextResponse.json(
        {
          error:
            "Invitation is invalid or has already been used.",
        },
        { status: 400 },
      );
    }

    if (
      invitation.expiresAt.getTime() <
      Date.now()
    ) {
      await db
        .update(businessInvitations)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(
          eq(
            businessInvitations.id,
            invitation.id,
          ),
        );

      return NextResponse.json(
        {
          error:
            "This invitation has expired.",
        },
        { status: 400 },
      );
    }

    if (
      !isBusinessRole(
        invitation.role,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invitation contains an invalid role.",
        },
        { status: 400 },
      );
    }

    if (
      invitation.role === "owner"
    ) {
      return NextResponse.json(
        {
          error:
            "Owner invitations are not allowed.",
        },
        { status: 400 },
      );
    }

    const sessionEmail =
      session.user.email
        ?.trim()
        .toLowerCase();

    const invitationEmail =
      invitation.email
        .trim()
        .toLowerCase();

    if (
      !sessionEmail ||
      sessionEmail !==
        invitationEmail
    ) {
      return NextResponse.json(
        {
          error:
            "This invitation was issued for a different email address.",
        },
        { status: 403 },
      );
    }

    const existingMembership =
      await db
        .select({
          id: businessUsers.id,
        })
        .from(businessUsers)
        .where(
          and(
            eq(
              businessUsers.businessId,
              invitation.businessId,
            ),
            eq(
              businessUsers.userId,
              session.user.id,
            ),
          ),
        )
        .limit(1);

    if (
      existingMembership.length >
      0
    ) {
      await db
        .update(businessInvitations)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          eq(
            businessInvitations.id,
            invitation.id,
          ),
        );

      return NextResponse.json({
        success: true,
        alreadyMember: true,
      });
    }

    await db.insert(businessUsers).values({
      id: crypto.randomUUID(),
      businessId:
        invitation.businessId,
      branchId:
        invitation.branchId,
      userId:
        session.user.id,
      role:
        invitation.role,
      permissions:
        invitation.permissions,
      createdAt: new Date(),
    });

    await db
      .update(businessInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        eq(
          businessInvitations.id,
          invitation.id,
        ),
      );

    await createAuditLog({
      businessId:
        invitation.businessId,

      userId:
        session.user.id,

      action:
        "user.invitation_accepted",

      resource:
        "business_invitation",

      resourceId:
        invitation.id,

      description:
        `${session.user.email} joined the business as ${invitation.role}.`,

      metadata: {
        email: invitation.email,
        role: invitation.role,
        branchId:
          invitation.branchId,
      },
    });

    return NextResponse.json({
      success: true,
      businessId:
        invitation.businessId,
      role:
        invitation.role,
    });
  } catch (error) {
    console.error(
      "Accept invitation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to accept invitation.",
      },
      { status: 500 },
    );
  }
}
