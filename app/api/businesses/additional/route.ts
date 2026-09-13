import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businessUsers } from "@/db/schema";
import { createBusinessForUser } from "@/lib/onboarding/create-business";

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
    const result = await createBusinessForUser(session.user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });
    }

    return NextResponse.json({ success: true, businessId: result.businessId }, { status: 201 });
  } catch (error) {
    console.error("Additional business creation error:", error);
    return NextResponse.json({ error: "Unable to create your business." }, { status: 500 });
  }
}
