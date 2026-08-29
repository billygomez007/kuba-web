import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leads } from "@/db/schema";
import { requireBusinessId } from "./business-context";
import { createAuditLog } from "@/lib/auth/audit";

export const updateLeadTool = createTool({
  id: "update-lead",

  description:
    "Update an existing lead belonging to the current business. Use this when the user asks to change a lead's name, email, phone, source, or sales stage.",

  inputSchema: z.object({
    leadId: z
      .string()
      .optional()
      .describe(
        "The lead ID, if already known.",
      ),

    leadName: z
      .string()
      .optional()
      .describe(
        "The name of the lead to update, if the lead ID is not known.",
      ),

    name: z
      .string()
      .optional()
      .describe("The lead's new name."),

    email: z
      .string()
      .email()
      .optional()
      .describe("The lead's new email address."),

    phone: z
      .string()
      .optional()
      .describe("The lead's new phone number."),

    source: z
      .string()
      .optional()
      .describe("The lead's new source."),

    stage: z
      .string()
      .optional()
      .describe(
        "The lead's new sales stage, such as new, contacted, qualified, or converted.",
      ),
  }),

  execute: async ({
    leadId,
    leadName,
    name,
    email,
    phone,
    source,
    stage,
  }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    let targetLeadId = leadId;

    if (!targetLeadId && leadName) {
      const matchingLeads = await db
        .select({
          id: leads.id,
        })
        .from(leads)
        .where(
          and(
            eq(leads.businessId, businessId),
            eq(leads.name, leadName),
          ),
        )
        .limit(1);

      targetLeadId = matchingLeads[0]?.id;
    }

    if (!targetLeadId) {
      return {
        success: false,
        error:
          "The lead could not be found. Please provide the lead name or lead ID.",
      };
    }

    const existingLead = await db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
      })
      .from(leads)
      .where(
        and(
          eq(leads.id, targetLeadId),
          eq(leads.businessId, businessId),
        ),
      )
      .limit(1);

    if (existingLead.length === 0) {
      return {
        success: false,
        error: "Lead not found.",
      };
    }

    const updates: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      source?: string | null;
      stage?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updates.name = name;
    }

    if (email !== undefined) {
      updates.email = email;
    }

    if (phone !== undefined) {
      updates.phone = phone;
    }

    if (source !== undefined) {
      updates.source = source;
    }

    if (stage !== undefined) {
      updates.stage = stage;
    }

    const updatedLead = await db
      .update(leads)
      .set(updates)
      .where(
        and(
          eq(leads.id, targetLeadId),
          eq(leads.businessId, businessId),
        ),
      )
      .returning({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
      });

    await createAuditLog({ businessId, userId: null, action: "ai.sales.update_lead", resource: "lead", resourceId: targetLeadId, description: `Kuba Sales updated lead "${updatedLead[0].name}".`, metadata: updates });

    return {
      success: true,
      lead: updatedLead[0],
    };
  },
});