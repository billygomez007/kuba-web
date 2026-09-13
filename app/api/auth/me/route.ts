import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers } from "@/db/schema";
import {
  getRolePermissions,
} from "@/lib/auth/permissions";
import { getBusinessMembershipStatus } from "@/lib/auth/tenant";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { getBusinessLocalization } from "@/lib/localization";
import { getUserOrganizations } from "@/lib/auth/organizations";

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

    // Portfolio membership is a display-only, additive signal here (which
    // organizations to offer a "Portfolio" entry point for) — it never
    // participates in the business-membership resolution above or in any
    // entitlement decision; those remain governed entirely by businessUsers/
    // subscriptions, unaffected by which portfolios this user belongs to.
    // Deliberately isolated in its own try/catch: this is optional metadata
    // for EVERY authenticated user's navigation load, so it must never take
    // down the entire dashboard — whether because a given environment's
    // database hasn't yet had the organizations/organization_members
    // migration applied, or for any other transient reason. A real
    // authentication or tenant-authorization failure is never masked by
    // this — those are decided entirely above/below this block, untouched.
    let organizations: { id: string; name: string; role: string }[] = [];
    try {
      organizations = (await getUserOrganizations(session.user.id)).map((row) => ({ id: row.organization.id, name: row.organization.name, role: row.role }));
    } catch (organizationsError) {
      console.error("Portfolio membership lookup failed (non-fatal — navigation continues without a portfolio entry point):", organizationsError);
    }

    const membershipStatus = await getBusinessMembershipStatus();

    // Neither of these is a genuine authorization failure — the user is
    // properly authenticated. "no_membership" is the normal state right
    // after signup, before onboarding creates a business; "ambiguous"
    // means they belong to more than one business with no current
    // selection. Both resolve with a 200 and a distinct `code` so the
    // client can route to onboarding or the existing business switcher
    // (populated from `businesses` below either way) instead of being
    // shown a confusing, unrecoverable-looking error. A stale/invalid
    // superkuba_business_id cookie can never produce either of these on
    // its own when the user has exactly one real membership — see
    // selectBusinessMembership's fallback in lib/auth/business-context-policy.ts.
    if (membershipStatus.status === "no_membership") {
      return NextResponse.json({
        success: true,
        code: "NO_BUSINESS_MEMBERSHIP",
        user: { id: session.user.id, name: session.user.name, email: session.user.email },
        membership: null,
        businesses: businessesForUser,
        organizations,
      });
    }

    if (membershipStatus.status === "ambiguous") {
      return NextResponse.json({
        success: true,
        code: "AMBIGUOUS_BUSINESS_SELECTION",
        user: { id: session.user.id, name: session.user.name, email: session.user.email },
        membership: null,
        businesses: businessesForUser,
        organizations,
      });
    }

    if (membershipStatus.status === "unauthenticated") {
      // Defense in depth only — session was already confirmed valid above;
      // this guards the exotic case where it expired between the two calls.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = membershipStatus.membership;

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
        entitlements: membership ? await getBusinessEntitlements(membership.businessId) : null,
        localization: membership ? await getBusinessLocalization(membership.businessId) : null,
      },
      businesses: businessesForUser,
      organizations,
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
