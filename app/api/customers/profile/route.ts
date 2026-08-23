import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  customers,
  conversations,
  leads,
  followUps,
} from "@/db/schema";


export async function GET(
  request: Request,
) {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });


  if (!session?.user) {
    return NextResponse.json(
      {
        error:"Unauthorized",
      },
      {
        status:401,
      },
    );
  }


  const { searchParams } =
    new URL(request.url);


  const customerId =
    searchParams.get("id");


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


  const customer =
    await db
      .select()
      .from(customers)
      .where(
        eq(
          customers.id,
          customerId,
        ),
      )
      .limit(1);


  const customerConversations =
    await db
      .select()
      .from(conversations)
      .where(
        eq(
          conversations.customerId,
          customerId,
        ),
      );


  const customerLeads =
    await db
      .select()
      .from(leads)
      .where(
        eq(
          leads.customerId,
          customerId,
        ),
      );


  const customerFollowUps: Array<Record<string, unknown>> =
    [];


  return NextResponse.json({
    customer:customer[0] || null,
    conversations:customerConversations,
    leads:customerLeads,
    followUps:customerFollowUps,
  });

}
