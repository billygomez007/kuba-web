import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers, customers } from "@/db/schema";

async function getBusinessForUser(userId: string) {
  const result = await db
    .select({
      business: businesses,
    })
    .from(businessUsers)
    .innerJoin(
      businesses,
      eq(businessUsers.businessId, businesses.id),
    )
    .where(eq(businessUsers.userId, userId))
    .limit(1);

  return result[0]?.business;
}

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

    const business = await getBusinessForUser(session.user.id);

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      );
    }

    const result = await db
      .select()
      .from(customers)
      .where(eq(customers.businessId, business.id))
      .orderBy(desc(customers.createdAt));

    return NextResponse.json({
      customers: result,
    });
  } catch (error) {
    console.error("Customer fetch error:", error);

    return NextResponse.json(
      { error: "Unable to load customers." },
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

    const business = await getBusinessForUser(session.user.id);

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      );
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const source = String(body.source || "").trim();

    if (!name && !email && !phone) {
      return NextResponse.json(
        { error: "Please provide at least a name, email, or phone number." },
        { status: 400 },
      );
    }

    const now = new Date();
    const customerId = crypto.randomUUID();

    await db.insert(customers).values({
      id: customerId,
      businessId: business.id,
      name: name || null,
      email: email || null,
      phone: phone || null,
      source: source || "manual",
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        customer: created[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Customer creation error:", error);

    return NextResponse.json(
      { error: "Unable to create customer." },
      { status: 500 },
    );
  }
}
