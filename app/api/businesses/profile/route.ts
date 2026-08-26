import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { createAuditLog } from "@/lib/auth/audit";
import { InvalidLocalizationError, upsertBusinessLocalization } from "@/lib/localization/business";

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

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      );
    }

    if (
      business.role !== "owner" &&
      business.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Only business owners and administrators can edit business information.",
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const name = String(formData.get("name") || "").trim();
    const industry = String(
      formData.get("industry") || "",
    ).trim();
    const country = String(
      formData.get("country") || "",
    ).trim();
    const businessSize = String(
      formData.get("businessSize") || "",
    ).trim();
    const logoUrl = String(
      formData.get("logoUrl") || "",
    ).trim();
    const localizationCountry = String(formData.get("localizationCountry") || "").trim();
    const localizationCurrency = String(formData.get("localizationCurrency") || "").trim();
    const localizationTimezone = String(formData.get("localizationTimezone") || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 },
      );
    }

    if (localizationCountry || localizationCurrency || localizationTimezone) {
      try {
        await upsertBusinessLocalization(business.businessId, {
          countryCode: localizationCountry,
          currencyCode: localizationCurrency,
          timezone: localizationTimezone,
        });
      } catch (error) {
        if (error instanceof InvalidLocalizationError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const now = new Date();

    await db
      .update(businesses)
      .set({
        name,
        industry: industry || null,
        country: country || null,
        businessSize: businessSize || null,
        logoUrl: logoUrl || null,
        updatedAt: now,
      })
      .where(eq(businesses.id, business.businessId));

    await createAuditLog({
      businessId: business.businessId,
      userId: session.user.id,
      action: "business.profile.updated",
      resource: "business",
      resourceId: business.businessId,
      metadata: { fields: ["name", "industry", "country", "businessSize", "logoUrl", "localizationCountry", "localizationCurrency", "localizationTimezone"] },
    });

    return NextResponse.redirect(
  new URL("/dashboard/settings/profile", request.url),
);
  } catch (error) {
    console.error(
      "Business profile update error:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to update business profile." },
      { status: 500 },
    );
  }
}