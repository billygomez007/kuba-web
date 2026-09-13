import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  aiEmployees,
  aiBusinessSettings,
  users,
} from "@/db/schema";
import { upsertBusinessLocalization } from "@/lib/localization/business";
import { isSupportedCountry, isSupportedCurrency, isValidTimezone, SUPPORTED_COUNTRIES } from "@/lib/localization/registry";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isOnboardingBusinessSize, isOnboardingGoal, isOnboardingIndustry } from "@/lib/onboarding/registry";
import { normalizeWebsiteUrl } from "@/lib/onboarding/website";

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
    const selected = selectedBusinessId
      ? result.find((row) => row.business.id === selectedBusinessId)
      : result.length === 1
        ? result[0]
        : null;

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

    const businessName = String(body.businessName || "").trim();
    const websiteInput = String(body.website || "").trim();
    const phone = String(body.phone || "").trim();
    const industry = String(body.industry || "").trim();
    const businessSize = String(body.businessSize || "").trim();
    const countryCodeInput = String(body.countryCode || "").trim().toUpperCase();
    const currencyCodeInput = String(body.currencyCode || "").trim().toUpperCase();
    const timezoneInput = String(body.timezone || "").trim();
    const countryCode = isSupportedCountry(countryCodeInput) ? countryCodeInput : null;
    const currencyCode = isSupportedCurrency(currencyCodeInput) ? currencyCodeInput : (countryCode ? SUPPORTED_COUNTRIES[countryCode].defaultCurrency : null);
    const timezone = isValidTimezone(timezoneInput) ? timezoneInput : (countryCode ? SUPPORTED_COUNTRIES[countryCode].defaultTimezone : null);
    const goals = Array.isArray(body.goals)
      ? body.goals
          .filter((goal: unknown): goal is string => typeof goal === "string")
          .map((goal: string) => goal.trim())
          .filter(Boolean)
      : [];

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

    // Structured, field-scoped validation — replaces a single generic
    // "one or more onboarding selections are invalid" message with a
    // specific reason per field, returned as both a top-level `error`
    // (whichever field failed first, for callers that only read that) and
    // a `fieldErrors` map (for a caller that wants to highlight the exact
    // field). The industry/business-size/goal checks read from the SAME
    // canonical registry the client's Step 2 form now renders its options
    // from (lib/onboarding/registry.ts), so a value the UI offers can never
    // fail here — this is the fix for the actual reported bug ("Software"
    // was free-typed into a field the server's enum had no match for).
    const websiteResult = normalizeWebsiteUrl(websiteInput);
    const fieldErrors: Record<string, string> = {};
    if (!businessName) fieldErrors.businessName = "Business name is required.";
    if (!industry) fieldErrors.industry = "Please select a valid industry.";
    else if (!isOnboardingIndustry(industry)) fieldErrors.industry = "Please select a valid industry.";
    if (!businessSize) fieldErrors.businessSize = "Please select a valid business size.";
    else if (!isOnboardingBusinessSize(businessSize)) fieldErrors.businessSize = "Please select a valid business size.";
    if (goals.length === 0) fieldErrors.goals = "Select at least one goal.";
    else if (goals.some((goal: string) => !isOnboardingGoal(goal))) fieldErrors.goals = "One or more goals are invalid.";
    if (websiteResult.error) fieldErrors.website = websiteResult.error;

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: Object.values(fieldErrors)[0], fieldErrors },
        { status: 400 },
      );
    }

    const website = websiteResult.value;

    const slug =
      businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const businessId = crypto.randomUUID();
    const now = new Date();

    // A business with no owner membership (or vice versa) is an invalid,
    // unrecoverable-by-the-user state — this is what leaves someone stuck
    // in the exact onboarding loop this fix addresses. Both rows are
    // created atomically; either both exist or neither does.
    await db.transaction(async (tx) => {
      await tx.insert(businesses).values({
        id: businessId,
        name: businessName,
        slug,
        website: website || null,
        industry: industry || null,
        country: countryCode ? SUPPORTED_COUNTRIES[countryCode].name : null,
        businessSize: businessSize || null,
        plan: "starter",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(businessUsers).values({
        id: crypto.randomUUID(),
        businessId,
        userId: session.user.id,
        role: "owner",
        createdAt: now,
      });
    });

    // Establishes selected-business context immediately — same convention
    // as app/api/businesses/select/route.ts. Not strictly required for a
    // user with exactly one membership (getCurrentMembership's fallback
    // already resolves that case), but explicit is safer than relying only
    // on the fallback, and this is the moment the selection is actually
    // known with certainty.
    (await cookies()).set("superkuba_business_id", businessId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    if (countryCode && currencyCode && timezone) {
      await upsertBusinessLocalization(businessId, { countryCode, currencyCode, timezone });
    }

    if (goals.length > 0) {
      await db.insert(aiBusinessSettings).values({
        id: crypto.randomUUID(),
        businessId,
        aiInstructions: `Primary business goals:\n${goals
          .map((goal: string) => `- ${goal}`)
          .join("\n")}`,
        tone: "professional",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (phone) {
      await db
        .update(users)
        .set({
          phone,
          updatedAt: now,
        })
        .where(eq(users.id, session.user.id));
    }

    return NextResponse.json(
      {
        success: true,
        businessId,
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
