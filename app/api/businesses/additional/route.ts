import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businessUsers } from "@/db/schema";
import { createBusinessForUser } from "@/lib/onboarding/create-business";
import { authorizeOrganizationLinkForUser, linkBusinessToOrganization } from "@/lib/onboarding/organization-link";
import type { OrganizationRole } from "@/lib/auth/organizations";

/**
 * "+ Add business" — for a user who ALREADY has at least one business
 * membership (a portfolio owner, or anyone who wants a second independent
 * workspace) to create another one. The mirror image of
 * app/api/businesses/route.ts's POST, which exists for exactly the OPPOSITE
 * case (a brand-new user's first business) and 409s if any membership
 * already exists. Both routes share the same creation logic
 * (lib/onboarding/create-business.ts) so a second business is created with
 * identical validation, atomicity, and default-plan behavior as a first one
 * always has — it is never automatically granted a higher plan than
 * Starter; a Realtegic-owned business's complimentary plan remains a
 * separate, later platform-admin action (see app/api/admin/businesses/[id]).
 *
 * An optional `organizationId` links the new business into a portfolio the
 * caller already belongs to as owner/admin (lib/onboarding/organization-link.ts).
 * This is validated BEFORE the business is created, so a denied or invalid
 * link never leaves an orphaned, unlinked business behind — unlike the
 * platform-admin `link_business` action
 * (app/api/admin/organizations/[id]/route.ts), which links an
 * already-existing business after the fact. Organization membership never
 * substitutes for the businessUsers.role="owner" row createBusinessForUser
 * always creates; it is purely additive grouping metadata.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const existingMembership = await db
      .select({ businessId: businessUsers.businessId })
      .from(businessUsers)
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    if (existingMembership.length === 0) {
      return NextResponse.json(
        { error: "Use onboarding to create your first business." },
        { status: 400 },
      );
    }

    const body = await request.json();

    const organizationIdInput =
      typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    let authorizedLink: { organizationId: string; role: OrganizationRole } | null = null;

    if (organizationIdInput) {
      const authorization = await authorizeOrganizationLinkForUser(session.user.id, organizationIdInput);
      if (!authorization.ok) {
        return NextResponse.json({ error: authorization.error }, { status: authorization.status });
      }
      authorizedLink = { organizationId: authorization.organizationId, role: authorization.role };
    }

    const result = await createBusinessForUser(session.user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });
    }

    if (authorizedLink) {
      await linkBusinessToOrganization({
        businessId: result.businessId,
        organizationId: authorizedLink.organizationId,
        actorUserId: session.user.id,
        actorOrganizationRole: authorizedLink.role,
      });
    }

    return NextResponse.json(
      {
        success: true,
        businessId: result.businessId,
        organizationId: authorizedLink?.organizationId ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Additional business creation error:", error);
    return NextResponse.json({ error: "Unable to create your business." }, { status: 500 });
  }
}
