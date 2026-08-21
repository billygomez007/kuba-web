import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  getBusinessMembership,
  getRolePermissions,
} from "@/lib/auth/permissions";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const [membership, platformUser] = await Promise.all([
      getBusinessMembership(session.user.id),
      db.select({ platformRole: users.platformRole })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1),
    ]);

    if (!membership) {
      if (platformUser[0]?.platformRole === "super_admin") {
        return NextResponse.json({
          success: true,
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            platformRole: "super_admin",
          },
          membership: null,
        });
      }

      return NextResponse.json(
        { error: "Business access denied." },
        { status: 403 },
      );
    }

    let permissions: string[];

    if (membership.role === "owner") {
      permissions = getRolePermissions("owner");
    } else {
      permissions = [
        ...getRolePermissions(membership.role),
      ];

      if (membership.permissions) {
        try {
          const custom =
            JSON.parse(membership.permissions);

          if (Array.isArray(custom)) {
            permissions = [
              ...new Set([
                ...permissions,
                ...custom.filter(
                  (value): value is string =>
                    typeof value === "string",
                ),
              ]),
            ];
          }
        } catch {
          // Ignore malformed custom permissions.
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        platformRole: platformUser[0]?.platformRole ?? "user",
      },
      membership: {
        businessId: membership.businessId,
        role: membership.role,
        branchId: membership.branchId,
        permissions,
      },
    });
  } catch (error) {
    console.error(
      "Load current user permissions error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load current user permissions.",
      },
      { status: 500 },
    );
  }
}
