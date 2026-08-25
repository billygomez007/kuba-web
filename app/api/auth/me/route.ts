import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers } from "@/db/schema";
import {
  getRolePermissions,
} from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

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

    const membership = await getCurrentMembership();

    const businessesForUser = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        role: businessUsers.role,
        branchId: businessUsers.branchId,
      })
      .from(businessUsers)
      .innerJoin(businesses, eq(businessUsers.businessId, businesses.id))
      .where(eq(businessUsers.userId, session.user.id));

    if (!membership && businessesForUser.length === 0) {
      return NextResponse.json(
        { error: "Business access denied." },
        { status: 403 },
      );
    }

    let permissions: string[];

    if (membership?.role === "owner") {
      permissions = getRolePermissions("owner");
    } else {
      permissions = [
        ...getRolePermissions(membership?.role || "member"),
      ];

      if (membership?.permissions) {
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
        businessId: membership?.businessId || null,
        role: membership?.role || null,
        branchId: membership?.branchId || null,
        permissions,
      },
      businesses: businessesForUser,
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
