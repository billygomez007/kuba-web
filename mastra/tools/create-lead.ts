import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { leads, aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const createLeadTool = createTool({
  id: "create-lead",

  description:
    "Create a new lead for the current business. Use this when the user asks to add, create, save, or register a new lead.",

  inputSchema: z.object({
    businessId: z
      .string()
      .describe("The ID of the business that owns the lead."),

    name: z
      .string()
      .min(1)
      .describe("The lead's full name."),

    email: z
      .string()
      .email()
      .optional()
      .describe("The lead's email address, if available."),

    phone: z
      .string()
      .optional()
      .describe("The lead's phone number, if available."),

    source: z
      .string()
      .optional()
      .describe(
        "Where the lead came from, such as website, WhatsApp, referral, Facebook, or Instagram.",
      ),
  }),

  execute: async ({
    businessId,
    name,
    email,
    phone,
    source,
  }) => {
    const leadId = crypto.randomUUID();
    const now = new Date();

    const salesEmployee = await db
      .select({
        id: aiEmployees.id,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.businessId, businessId),
          eq(aiEmployees.type, "sales"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const assignedEmployeeId =
      salesEmployee[0]?.id || null;

    const result = await db
      .insert(leads)
      .values({
        id: leadId,
        businessId,
        name,
        email: email || null,
        phone: phone || null,
        source: source || null,
        stage: "new",
        assignedEmployeeId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
      });

    return {
      success: true,
      lead: result[0],
    };
  },
});