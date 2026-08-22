import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  aiEmployees,
  users,
} from "@/db/schema";

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
        { error: "No business is associated with this account." },
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

    if (!businessName) {
      return NextResponse.json(
        { error: "Business name is required." },
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
