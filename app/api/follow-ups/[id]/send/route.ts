import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  followUps,
  leads,
  aiEmployees,
} from "@/db/schema";

import { createPendingAIAction } from "@/lib/ai/security";
import { authorizationErrorResponse, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";


export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {

    const access = await requirePermission(
      PERMISSIONS.FOLLOWUPS_MANAGE,
      request,
    );


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
            access.business.id,
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

    const salesEmployee = await db
      .select({ id: aiEmployees.id })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.businessId, access.business.id),
          eq(aiEmployees.type, "sales"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    if (!salesEmployee[0]) {
      return NextResponse.json(
        { error: "No active Sales AI employee is available." },
        { status: 409 },
      );
    }


    const { id: approvalId } = await createPendingAIAction({
      businessId: access.business.id,
      employeeId: salesEmployee[0].id,
      channel: "whatsapp",
      recipient: lead.phone,
      message,
    });

    return NextResponse.json({
      success: true,
      status: "approval_required",
      approvalId,
    });


  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;

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
