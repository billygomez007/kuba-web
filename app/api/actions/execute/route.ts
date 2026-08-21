import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { requireAIEmployeeAction } from "@/lib/ai/security";
import { getChannelAdapter } from "@/lib/channels/router";
import type { ChannelType } from "@/lib/channels/types";
import { logAIActivity } from "@/lib/ai/activity-log";
import { authorizationErrorResponse, logSecurityEvent, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof requirePermission>> | null = null;
  let actionId: string | null = null;

  try {
    context = await requirePermission(PERMISSIONS.MESSAGING_MANAGE, request);
    const body = await request.json();
    actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
    if (!actionId) return NextResponse.json({ error: "Action ID is required." }, { status: 400 });

    const action = (await db.update(actionApprovals)
      .set({ status: "executing", updatedAt: new Date() })
      .where(and(eq(actionApprovals.id, actionId), eq(actionApprovals.businessId, context.business.id), eq(actionApprovals.status, "approved")))
      .returning())[0];
    if (!action) {
      await logSecurityEvent({ context, request, action: "action.execute", resource: "action_approval", resourceId: actionId, result: "denied" });
      return NextResponse.json({ error: "Approved action not found." }, { status: 404 });
    }

    if (action.employeeId) {
      await requireAIEmployeeAction({
        businessId: context.business.id,
        employeeId: action.employeeId,
        action: "external_communication",
      });
    }

    const channel = action.channel as ChannelType;
    if (!new Set<ChannelType>(["whatsapp", "facebook", "instagram", "telegram", "email", "sms", "website"]).has(channel)) {
      throw new Error("Unsupported action channel.");
    }

    await getChannelAdapter(channel).send({
      businessId: context.business.id,
      conversationId: "",
      recipient: action.recipient,
      message: action.message,
    });

    if (action.employeeId) {
      await logAIActivity({
        businessId: context.business.id,
        employeeId: action.employeeId,
        type: "action_completed",
        title: "AI action executed",
        description: `${action.channel}: ${action.message}`,
      });
    }

    await db.update(actionApprovals)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(actionApprovals.id, action.id), eq(actionApprovals.businessId, context.business.id), eq(actionApprovals.status, "executing")));
    await logSecurityEvent({ context, request, action: "action.execute", resource: "action_approval", resourceId: action.id, result: "success" });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (context && actionId) {
      await db.update(actionApprovals)
        .set({ status: "approved", updatedAt: new Date() })
        .where(and(eq(actionApprovals.id, actionId), eq(actionApprovals.businessId, context.business.id), eq(actionApprovals.status, "executing")));
      await logSecurityEvent({ context, request, action: "action.execute", resource: "action_approval", resourceId: actionId, result: "failure" });
    }
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to execute action." }, { status: 500 });
  }
}
