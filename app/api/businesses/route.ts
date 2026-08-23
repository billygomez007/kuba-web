import { NextResponse } from "next/server";
import { headers } from "next/headers";
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

const onboardingIndustries = new Set([
  "Travel",
  "Healthcare",
  "Real Estate",
  "Education",
  "Retail",
  "Professional Services",
  "Other",
]);

const onboardingBusinessSizes = new Set([
  "Solo",
  "2-10 employees",
  "11-50 employees",
  "51-200 employees",
  "200+",
]);

const onboardingGoals = new Set([
  "Get more customers",
  "Automate customer support",
  "Improve sales follow-up",
  "Reduce repetitive work",
  "Manage operations",
  "Improve response time",
]);

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
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(businessUsers.businessId, businesses.id),
      )
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const business = result[0]?.business;

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

    return NextResponse.json({
      business,
      employees,
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
    const website = String(body.website || "").trim();
    const phone = String(body.phone || "").trim();
    const industry = String(body.industry || "").trim();
    const businessSize = String(body.businessSize || "").trim();
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

    if (!businessName || !industry || !businessSize || goals.length === 0) {
      return NextResponse.json(
        { error: "Company name, industry, business size, and at least one goal are required." },
        { status: 400 },
      );
    }

    if (
      (industry && !onboardingIndustries.has(industry)) ||
      (businessSize && !onboardingBusinessSizes.has(businessSize)) ||
      goals.some((goal: string) => !onboardingGoals.has(goal))
    ) {
      return NextResponse.json(
        { error: "One or more onboarding selections are invalid." },
        { status: 400 },
      );
    }

    const slug =
      businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const businessId = crypto.randomUUID();
    const now = new Date();

    await db.insert(businesses).values({
      id: businessId,
      name: businessName,
      slug,
      website: website || null,
      industry: industry || null,
      businessSize: businessSize || null,
      plan: "starter",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(businessUsers).values({
      id: crypto.randomUUID(),
      businessId,
      userId: session.user.id,
      role: "owner",
      createdAt: now,
    });

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
