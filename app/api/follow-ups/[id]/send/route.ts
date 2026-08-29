import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  followUps,
  leads,
} from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { sendWhatsAppToPhone } from "@/lib/channels/whatsapp";

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

    const membership = await getCurrentMembership();

    if (!membership) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.MESSAGING_MANAGE)) {
      return NextResponse.json(
        { error: "You do not have permission to send messages." },
        { status: 403 },
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
            membership.businessId,
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

    const response = await sendWhatsAppToPhone({
      businessId: membership.businessId,
      phone: lead.phone,
      message,
    });

    await createAuditLog({
      businessId: membership.businessId,
      userId: session.user.id,
      action: "communication.whatsapp.send",
      resource: "follow_up",
      resourceId: id,
      description: response.success ? `Sent a WhatsApp message to lead "${lead.name}".` : "WhatsApp message send failed.",
      metadata: { leadId: lead.id, success: response.success, error: response.error || null },
    });

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
