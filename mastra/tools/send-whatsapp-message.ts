import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { createPendingAIAction } from "@/lib/ai/security";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const sendWhatsAppMessageTool = createTool({
  id: "send-whatsapp-message",
  description:
    "Request approval for a WhatsApp message. This tool never sends a message directly.",
  inputSchema: z.object({
    businessId: z.string(),
    phone: z.string().min(1),
    message: z.string().min(1),
  }),
  execute: async ({ businessId, phone, message }) => {
    const recipient = phone.trim();
    const content = message.trim();
    if (!recipient || !content) {
      return { success: false, error: "A recipient and message are required." };
    }

    const employee = (await db.select({ id: aiEmployees.id })
      .from(aiEmployees)
      .where(and(
        eq(aiEmployees.businessId, businessId),
        eq(aiEmployees.type, "sales"),
        eq(aiEmployees.status, "active"),
      ))
      .limit(1))[0];
    if (!employee) {
      return { success: false, error: "No active Sales AI employee is available for this business." };
    }

    const { id: approvalId } = await createPendingAIAction({
      businessId,
      employeeId: employee.id,
      channel: "whatsapp",
      recipient,
      message: content,
    });

    return {
      success: true,
      status: "approval_required",
      approvalId,
      messageToUser: "The WhatsApp message is awaiting approval.",
    };
  },
});
