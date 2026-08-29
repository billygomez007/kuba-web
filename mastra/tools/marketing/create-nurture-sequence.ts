import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";
import { saveMarketingDraft } from "./draft-store";

const nurtureStepSchema = z.object({
  dayOffset: z.number().describe("Days after the sequence starts."),
  channel: z.string(),
  message: z.string(),
  cta: z.string().optional(),
});

export const createNurtureSequenceTool = createTool({
  id: "create-nurture-sequence",

  description:
    "Create a lead or customer nurture sequence as a draft. Covers new/warm/inactive/qualified leads, missed appointments, abandoned conversations, and past customers. Messages are drafts only — none are sent by this tool.",

  inputSchema: z.object({
    sequenceName: z.string(),
    segment: z.string().describe("e.g. new leads, inactive leads, missed appointments, past customers"),
    objective: z.string(),
    steps: z.array(nurtureStepSchema).min(1),
    salesHandoffTrigger: z.string().optional().describe("Condition under which this sequence should hand the lead to Sales."),
    humanEscalationCondition: z.string().optional(),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingAdvanced");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const result = await saveMarketingDraft({
      businessId: gate.businessId,
      type: "marketing.nurture_sequence.created",
      title: `Nurture sequence: ${input.sequenceName}`,
      draft: { ...input, status: "draft" },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: "draft",
      draftId: result.draftId,
      sequence: input,
      message:
        "Nurture sequence created as a draft. Sending any message in this sequence requires an approved external-action request first.",
    };
  },
});
