import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  aiEmployees,
} from "@/db/schema";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { createBusinessForUser } from "@/lib/onboarding/create-business";
import { selectBusinessMembership } from "@/lib/auth/business-context-policy";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const result = await db
      .select({
        business: businesses,
        role: businessUsers.role,
        permissions: businessUsers.permissions,
        branchId: businessUsers.branchId,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(businessUsers.businessId, businesses.id),
      )
      .where(eq(businessUsers.userId, session.user.id))
      ;

    const selectedBusinessId = (await cookies()).get("superkuba_business_id")?.value;
    // Same recovery policy as getBusinessMembershipStatus()/getCurrentMembership()
    // (lib/auth/tenant.ts): a selectedBusinessId that doesn't match any of
    // this user's own memberships is discarded, never a dead end — this
    // previously used its own local, less permissive re-implementation
    // (a stale/foreign cookie value fell straight to `undefined` with no
    // fallback, even for a user with exactly one real membership).
    const candidates = result.map((row) => ({ ...row, businessId: row.business.id }));
    const selected = selectBusinessMembership(candidates, selectedBusinessId);

    const business = selected?.business;

    if (!business) {
      return NextResponse.json(
        {
          error: "No business is associated with this account.",
          onboardingStatus: "new_user",
        },
        { status: 404 },
      );
    }

    const employees = await db
      .select()
      .from(aiEmployees)
      .where(eq(aiEmployees.businessId, business.id));

    // Resolved (subscription/trial-aware) entitlements, exposed read-only so
    // the workforce catalog UI can render accurate lock/upgrade states.
    // This is presentation data only — every activation and runtime route
    // re-resolves and re-checks entitlements itself; nothing trusts this
    // value as authorization.
    const entitlements = await getBusinessEntitlements(business.id);

    return NextResponse.json({
      business,
      employees,
      entitlements,
      businesses: result.map((row) => ({ ...row.business, role: row.role, branchId: row.branchId })),
      selectedBusinessId: selected?.business.id || null,
      onboardingStatus:
        employees.length > 0
          ? "onboarding_completed"
          : "business_setup_completed",
    });
  } catch (error) {
    console.error("Business fetch error:", error);

    return NextResponse.json(
      { error: "Unable to load your business." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const body = await request.json();

    // First-time onboarding only: a user who already has ANY membership
    // must use POST /api/businesses/additional instead (a portfolio owner
    // adding a second/third business), never silently create a second
    // business through this route. This 409 is what onboarding's own
    // retry/idempotency behavior depends on — unchanged by the multi-
    // business work below.
    const existingMembership = await db
      .select({ businessId: businessUsers.businessId })
      .from(businessUsers)
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json(
        {
          error: "Your business workspace has already been created.",
          businessId: existingMembership[0].businessId,
        },
        { status: 409 },
      );
    }

    const result = await createBusinessForUser(session.user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        businessId: result.businessId,
        onboardingStatus: "business_setup_completed",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Business creation error:", error);

    return NextResponse.json(
      { error: "Unable to create your business." },
      { status: 500 },
    );
  }
}
