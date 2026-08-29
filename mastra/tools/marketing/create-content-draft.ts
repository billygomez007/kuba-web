import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";
import { saveMarketingDraft } from "./draft-store";

export const CONTENT_CHANNELS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "x",
  "whatsapp",
  "sms",
  "email",
  "blog",
  "landing_page",
  "ad_copy",
  "video_script",
  "product_description",
  "case_study",
  "event_promotion",
  "announcement",
  "customer_education",
  "faq",
  "lead_nurture",
] as const;

export const createContentDraftTool = createTool({
  id: "create-content-draft",

  description:
    "Create a channel-appropriate marketing content draft (social post, email, ad copy, landing page copy, video script, etc). This is a draft only — nothing is published. Adapt tone, length, and structure to the target channel rather than reusing the same copy everywhere.",

  inputSchema: z.object({
    channel: z.enum(CONTENT_CHANNELS),
    headline: z.string().optional(),
    body: z.string(),
    cta: z.string().optional(),
    notes: z.string().optional().describe("Assumptions, tone choices, or anything the reviewer should know."),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const result = await saveMarketingDraft({
      businessId: gate.businessId,
      type: "marketing.content_draft.created",
      title: `${input.channel} content draft`,
      draft: { ...input, status: "draft" },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: "draft",
      draftId: result.draftId,
      content: input,
      message: `${input.channel} content draft created. It has not been published or sent anywhere.`,
    };
  },
});
