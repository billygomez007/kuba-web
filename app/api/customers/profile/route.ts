import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  customers,
  conversations,
  leads,
  followUps,
  customerTags,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";


export async function GET(
  request: Request,
) {

  const { user, membership, error } = await requireBusinessMembership();

  if (!user) {
    return NextResponse.json(
      {
        error:error || "Unauthorized",
      },
      {
        status:401,
      },
    );
  }

  if (!membership) {
    return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });
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
        and(eq(customers.id, customerId), eq(customers.businessId, membership.businessId)),
      )
      .limit(1);

  if (!customer[0]) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }


  const customerConversations =
    await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.customerId, customerId), eq(conversations.businessId, membership.businessId)),
      );


  const customerLeads =
    await db
      .select()
      .from(leads)
      .where(
        and(eq(leads.customerId, customerId), eq(leads.businessId, membership.businessId)),
      );

  const leadIds = customerLeads.map((lead) => lead.id);
  const customerFollowUps = leadIds.length
    ? await db.select().from(followUps).where(and(eq(followUps.businessId, membership.businessId), inArray(followUps.leadId, leadIds)))
    : [];
  const tags = await db.select().from(customerTags).where(eq(customerTags.customerId, customerId));


  return NextResponse.json({
    customer:customer[0] || null,
    conversations:customerConversations,
    leads:customerLeads,
    followUps:customerFollowUps,
    tags,
  });

}
