import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";
import { saveMarketingDraft } from "./draft-store";

const calendarEntrySchema = z.object({
  date: z.string().describe("ISO date for this content item."),
  campaign: z.string().optional(),
  channel: z.string(),
  audience: z.string().optional(),
  theme: z.string(),
  contentFormat: z.string(),
  headline: z.string().optional(),
  draftCopy: z.string().optional(),
  cta: z.string().optional(),
  owner: z.string().optional(),
});

export const createContentCalendarTool = createTool({
  id: "create-content-calendar",

  description:
    "Create a content calendar (7/14/30-day, monthly, or quarterly) as a draft plan. Each entry represents a planned piece of content, not a scheduled or published post.",

  inputSchema: z.object({
    calendarName: z.string(),
    period: z.string().describe("e.g. 7-day, 14-day, 30-day, monthly, quarterly"),
    entries: z.array(calendarEntrySchema).min(1),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingAdvanced");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const entriesWithStatus = input.entries.map((entry) => ({ ...entry, status: "draft", approvalState: "not_submitted" }));

    const result = await saveMarketingDraft({
      businessId: gate.businessId,
      type: "marketing.content_calendar.created",
      title: `Content calendar: ${input.calendarName} (${input.period})`,
      draft: { calendarName: input.calendarName, period: input.period, entries: entriesWithStatus },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: "draft",
      draftId: result.draftId,
      calendarName: input.calendarName,
      period: input.period,
      entryCount: entriesWithStatus.length,
      entries: entriesWithStatus,
      message: "Content calendar created as a draft plan. No content in it has been scheduled or published.",
    };
  },
});
