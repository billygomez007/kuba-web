import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessUsers,
  users,
} from "@/db/schema";

import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
  isBusinessRole,
  canManageRole,
  filterGrantablePermissions,
} from "@/lib/auth/permissions";
import { getBranchForBusiness } from "@/lib/auth/tenant";

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

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_VIEW,
      )
    ) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const members =
      await db
        .select({
          id: businessUsers.id,
          userId: businessUsers.userId,
          name: users.name,
          email: users.email,
          role: businessUsers.role,
          permissions:
            businessUsers.permissions,
          branchId:
            businessUsers.branchId,
          createdAt:
            businessUsers.createdAt,
        })
        .from(businessUsers)
        .innerJoin(
          users,
          eq(
            businessUsers.userId,
            users.id,
          ),
        )
        .where(
          eq(
            businessUsers.businessId,
            membership.businessId,
          ),
        );

    return NextResponse.json({
      success: true,
      members,
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

export async function PATCH(
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

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_MANAGE,
      )
    ) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const body =
      await request.json();

    const memberId =
      typeof body.memberId === "string"
        ? body.memberId.trim()
        : "";

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required." },
        { status: 400 },
      );
    }

    const memberResult =
      await db
        .select({
          id: businessUsers.id,
          userId:
            businessUsers.userId,
          role:
            businessUsers.role,
        })
        .from(businessUsers)
        .where(
          and(
            eq(
              businessUsers.id,
              memberId,
            ),
            eq(
              businessUsers.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    const member =
      memberResult[0];

    if (!member) {
      return NextResponse.json(
        { error: "Team member not found." },
        { status: 404 },
      );
    }

    if (
      member.userId ===
      session.user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot modify your own team membership.",
        },
        { status: 400 },
      );
    }

    const updates: {
      role?: string;
      permissions?: string | null;
      branchId?: string | null;
    } = {};
    let emailChanged = false;

    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
      }
      const duplicate = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (duplicate[0] && duplicate[0].id !== member.userId) {
        return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
      }
      await db.update(users).set({ email, emailVerified: false, updatedAt: new Date() }).where(eq(users.id, member.userId));
      emailChanged = true;
    }

    if (
      typeof body.role === "string"
    ) {
      const role =
        body.role
          .trim()
          .toLowerCase();

      if (!isBusinessRole(role)) {
        return NextResponse.json(
          { error: "Invalid role." },
          { status: 400 },
        );
      }

      if (
        role === "owner" ||
        !canManageRole(
          membership.role,
          role,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "You are not allowed to assign this role.",
          },
          { status: 403 },
        );
      }

      updates.role = role;
    }

    if (
      body.permissions === null ||
      Array.isArray(body.permissions)
    ) {
      if (
        Array.isArray(
          body.permissions,
        )
      ) {
        const requestedPermissions =
          body.permissions.filter(
            (permission: unknown) =>
              typeof permission === "string",
          );

        const grantablePermissions =
          filterGrantablePermissions(
            membership.role,
            requestedPermissions,
          );

        if (
          grantablePermissions.length !==
          requestedPermissions.length
        ) {
          return NextResponse.json(
            {
              error:
                "You are not allowed to grant one or more requested permissions.",
            },
            { status: 403 },
          );
        }

        updates.permissions =
          JSON.stringify(
            grantablePermissions,
          );
      } else {
        updates.permissions = null;
      }
    }

    if (
      body.branchId === null ||
      typeof body.branchId === "string"
    ) {
      updates.branchId =
        body.branchId === null
          ? null
          : body.branchId.trim() || null;
      if (updates.branchId && !(await getBranchForBusiness(updates.branchId, membership.businessId))) {
        return NextResponse.json({ error: "Branch does not belong to the selected business." }, { status: 400 });
      }
    }

    if (member.role === "owner" && updates.role && updates.role !== "owner") {
      const owners = await db
        .select({ id: businessUsers.id })
        .from(businessUsers)
        .where(and(eq(businessUsers.businessId, membership.businessId), eq(businessUsers.role, "owner")));
      if (owners.length <= 1) {
        return NextResponse.json({ error: "The last business owner cannot be demoted." }, { status: 409 });
      }
    }

    if (
      Object.keys(updates)
        .length === 0 &&
      !emailChanged
    ) {
      return NextResponse.json(
        {
          error:
            "No changes supplied.",
        },
        { status: 400 },
      );
    }

    await db
      .update(businessUsers)
      .set(updates)
      .where(
        and(
          eq(
            businessUsers.id,
            memberId,
          ),
          eq(
            businessUsers.businessId,
            membership.businessId,
          ),
        ),
      );

    await createAuditLog({
      businessId:
        membership.businessId,

      userId:
        session.user.id,

      action:
        "team.member_updated",

      resource:
        "business_user",

      resourceId:
        memberId,

      description:
        `Updated team member ${memberId}.`,

      metadata: updates,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Update team member error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update team member.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.USERS_MANAGE,
      )
    ) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const body =
      await request.json();

    const memberId =
      typeof body.memberId === "string"
        ? body.memberId.trim()
        : "";

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required." },
        { status: 400 },
      );
    }

    const memberResult =
      await db
        .select({
          id: businessUsers.id,
          userId:
            businessUsers.userId,
          role: businessUsers.role,
        })
        .from(businessUsers)
        .where(
          and(
            eq(
              businessUsers.id,
              memberId,
            ),
            eq(
              businessUsers.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    const member =
      memberResult[0];

    if (!member) {
      return NextResponse.json(
        { error: "Team member not found." },
        { status: 404 },
      );
    }

    if (
      member.userId ===
      session.user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot remove yourself.",
        },
        { status: 400 },
      );
    }

    if (member.role === "owner") {
      const owners = await db
        .select({ id: businessUsers.id })
        .from(businessUsers)
        .where(and(eq(businessUsers.businessId, membership.businessId), eq(businessUsers.role, "owner")));
      if (owners.length <= 1) {
        return NextResponse.json({ error: "The last business owner cannot be removed." }, { status: 409 });
      }
    }

    await db
      .delete(businessUsers)
      .where(
        and(
          eq(
            businessUsers.id,
            memberId,
          ),
          eq(
            businessUsers.businessId,
            membership.businessId,
          ),
        ),
      );

    await createAuditLog({
      businessId:
        membership.businessId,

      userId:
        session.user.id,

      action:
        "team.member_removed",

      resource:
        "business_user",

      resourceId:
        memberId,

      description:
        `Removed team member ${memberId}.`,
    });

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
