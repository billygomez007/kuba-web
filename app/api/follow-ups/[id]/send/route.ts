import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessUsers,
  followUps,
  leads,
} from "@/db/schema";

import { sendWhatsAppMessageTool } from "@/mastra/tools/send-whatsapp-message";


export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {

    const session = await auth.api.getSession({
      headers: await headers(),
    });


    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }


    const { id } = await context.params;


    const body = await request.json();

    const message = String(
      body.message || "",
    ).trim();


    if (!message) {
      return NextResponse.json(
        { error: "Message required" },
        { status: 400 },
      );
    }


    const membership = await db
      .select({
        businessId:
          businessUsers.businessId,
      })
      .from(businessUsers)
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);


    const business = membership[0];


    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }


    const result = await db
      .select({
        lead: leads,
      })
      .from(followUps)
      .leftJoin(
        leads,
        eq(
          leads.id,
          followUps.leadId,
        ),
      )
      .where(
        and(
          eq(
            followUps.id,
            id,
          ),
          eq(
            followUps.businessId,
            business.businessId,
          ),
        ),
      )
      .limit(1);


    const lead = result[0]?.lead;


    if (!lead?.phone) {
      return NextResponse.json(
        {
          error:
            "Lead does not have a phone number.",
        },
        { status: 400 },
      );
    }


    const response =
      await sendWhatsAppMessageTool.execute!(
        {
          phone: lead.phone,
          message,
        },
        {
          requestContext: new RequestContext([["businessId", business.businessId]]),
        } as Parameters<NonNullable<typeof sendWhatsAppMessageTool.execute>>[1],
      );


    return NextResponse.json(response);


  } catch (error) {

    console.error(
      "Follow-up WhatsApp send error",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to send WhatsApp message.",
      },
      {
        status: 500,
      },
    );
  }
}
