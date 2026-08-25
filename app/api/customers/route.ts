import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        { error: error || "You must be signed in." },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: error || "Business access denied." },
        { status: 403 },
      );
    }

    const result = await db
      .select()
      .from(customers)
      .where(eq(customers.businessId, membership.businessId))
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
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        { error: error || "You must be signed in." },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: error || "Business access denied." },
        { status: 403 },
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
      businessId: membership.businessId,
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
