import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  customerTags,
  customers,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";

async function requireOwnedCustomer(customerId: string) {
  const context = await requireBusinessMembership();
  if (!context.user || !context.membership) return { ...context, customer: null };
  const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, context.membership.businessId))).limit(1);
  return { ...context, customer: customer[0] ?? null };
}


export async function POST(
  request: Request,
) {

  const body = await request.json();
  const customerId = String(body.customerId || "").trim();
  const tag = String(body.tag || "").trim();
  const context = await requireOwnedCustomer(customerId);

  if (!context.user) {
    return NextResponse.json(
      {
        error:"Unauthorized",
      },
      {
        status:401,
      },
    );
  }


  if (!customerId || !tag) {
    return NextResponse.json(
      {
        error:"Customer and tag required",
      },
      {
        status:400,
      },
    );
  }

  if (!context.membership || !context.customer) {
    return NextResponse.json({ error: "Customer not found for the selected business." }, { status: 404 });
  }


  await db.insert(customerTags).values({

    id:
      crypto.randomUUID(),

    customerId,

    tag,

    createdAt:
      new Date(),

  });


  return NextResponse.json({
    success:true,
  });

}



export async function GET(
  request: Request,
) {

  const { searchParams } =
    new URL(request.url);


  const customerId =
    searchParams.get("customerId");


  if (!customerId) {
    return NextResponse.json(
      {
        error:"Customer required",
      },
      {
        status:400,
      },
    );
  }

  const context = await requireOwnedCustomer(customerId);
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.membership || !context.customer) return NextResponse.json({ error: "Customer not found for the selected business." }, { status: 404 });


  const tags =
    await db
      .select()
      .from(customerTags)
      .where(
        eq(
          customerTags.customerId,
          customerId,
        ),
      );


  return NextResponse.json({
    tags,
  });

}
