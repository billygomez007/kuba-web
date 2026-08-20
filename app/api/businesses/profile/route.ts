import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers } from "@/db/schema";

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

    const membership = await db
      .select({
        businessId: businessUsers.businessId,
        role: businessUsers.role,
      })
      .from(businessUsers)
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const business = membership[0];

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

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 },
      );
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