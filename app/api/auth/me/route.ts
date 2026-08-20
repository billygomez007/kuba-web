import { NextResponse } from "next/server";
import { headers } from "next/headers";

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

    const membership = await getBusinessMembership(
      session.user.id,
    );

    if (!membership) {
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
