import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, businessUsers, aiBusinessSettings, users } from "@/db/schema";
import { upsertBusinessLocalization } from "@/lib/localization/business";
import { isSupportedCountry, isSupportedCurrency, isValidTimezone, SUPPORTED_COUNTRIES } from "@/lib/localization/registry";
import { isOnboardingBusinessSize, isOnboardingGoal, isOnboardingIndustry } from "@/lib/onboarding/registry";
import { normalizeWebsiteUrl } from "@/lib/onboarding/website";

export type CreateBusinessResult =
  | { ok: true; businessId: string }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

/**
 * The single business+owner-membership creation path, shared by the
 * first-time onboarding route (app/api/businesses/route.ts, which gates on
 * the user having NO existing membership) and the additional-business route
 * (app/api/businesses/additional/route.ts, which gates on the OPPOSITE —
 * the user already having at least one). Extracted so a portfolio owner
 * creating their second, third, fourth business goes through the exact same
 * validation, atomicity, and side-effect behavior as everyone's first
 * business always has — never a second, drifting reimplementation.
 *
 * Deliberately does NOT decide who is allowed to call it or under what
 * membership-count condition — that policy differs between the two callers
 * and stays in each route.
 */
export async function createBusinessForUser(userId: string, body: Record<string, unknown>): Promise<CreateBusinessResult> {
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
    return { ok: false, status: 400, error: Object.values(fieldErrors)[0], fieldErrors };
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
  // unrecoverable-by-the-user state. Both rows are created atomically;
  // either both exist or neither does.
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
      userId,
      role: "owner",
      createdAt: now,
    });
  });

  // Establishes selected-business context immediately — same convention as
  // app/api/businesses/select/route.ts. For a portfolio owner adding an
  // additional business, this is also the natural UX: you just created it,
  // so it becomes the workspace you're now looking at.
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
      .set({ phone, updatedAt: now })
      .where(eq(users.id, userId));
  }

  return { ok: true, businessId };
}
