import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachCampaignSends } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { createCampaign, addSequenceStep, getCampaignOrThrow, listSequenceSteps } from "@/lib/outreach/campaign-service";
import { enrollRecipients } from "@/lib/outreach/recipient-enrollment";

/**
 * Deterministic Outreach Campaign Engine tools for the AI employee.
 *
 * EXECUTION BOUNDARY (do not weaken): these tools let the agent PREPARE a
 * campaign — draft it, enroll already-researched contacts, propose
 * sequence content, read back a summary/performance. There is no tool
 * here for launch, schedule, pause, resume, or stop, and none for sending
 * a message directly. Launch is the v1 human approval event
 * (lib/outreach/campaign-lifecycle.ts's launchCampaignNow/scheduleCampaign,
 * only reachable through the authenticated API routes in
 * app/api/outreach/campaigns/[campaignId]/{launch,schedule}), and actual
 * delivery only ever happens through the durable send worker
 * (lib/outreach/process-send.ts) calling the provider. An agent proposing
 * a sequence step's content still writes it through the exact same
 * addSequenceStep the API routes use — same validation, same mutability
 * rules — it does not get a special bypass path.
 */

async function requireOwnedCampaign(businessId: string, employeeId: string, campaignId: string) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  if (campaign.employeeId !== employeeId) {
    throw new Error("This campaign does not belong to the active Outreach employee.");
  }
  return campaign;
}

export const createCampaignDraftTool = createTool({
  id: "create-campaign-draft",

  description:
    "Create a new draft Outreach campaign for the current business. The campaign starts empty — sequence steps and recipients are added separately, and nothing is scheduled or sent until a human explicitly launches it.",

  inputSchema: z.object({
    name: z.string().min(1).max(200).describe("A clear, human-readable campaign name."),
    description: z.string().max(2000).optional().describe("What this campaign is for and who it targets."),
    channel: z.enum(["email"]).default("email").describe("Delivery channel. Only email is available today."),
  }),

  execute: async ({ name, description, channel }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    const campaign = await createCampaign({ businessId, employeeId, name, description: description ?? null, channel });
    return { success: true, campaignId: campaign.id, status: campaign.status };
  },
});

export const addResearchedContactsToCampaignTool = createTool({
  id: "add-researched-contacts-to-campaign",

  description:
    "Enroll one or more already-saved Outreach contacts (from saveOutreachContact / getOutreachProspects) into a draft campaign. Only works while the campaign is still a draft. Returns a per-contact outcome — enrollment is never all-or-nothing for a batch.",

  inputSchema: z.object({
    campaignId: z.string().min(1),
    contactIds: z.array(z.string().min(1)).min(1).max(500),
  }),

  execute: async ({ campaignId, contactIds }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    await requireOwnedCampaign(businessId, employeeId, campaignId);
    const results = await enrollRecipients(businessId, campaignId, contactIds);
    return { success: true, results };
  },
});

export const proposeSequenceStepTool = createTool({
  id: "propose-sequence-step",

  description:
    "Add the next sequence step to a draft campaign, using deterministic {{variable}} placeholders (e.g. {{displayName}}) for per-recipient personalization at send time — never a hand-written value per recipient. Ground the content in the business's actual products/services/tone (getBusinessKnowledge) and, where relevant, real saved research evidence for the campaign's prospects — never invent facts about a recipient or their company. Only works while the campaign is still a draft.",

  inputSchema: z.object({
    campaignId: z.string().min(1),
    delayHours: z.number().min(0).describe("Hours after enrollment (step 1) or after the previous step's send (step 2+) before this step becomes due."),
    subjectTemplate: z.string().max(300).optional(),
    bodyTemplate: z.string().min(1).max(20000),
  }),

  execute: async ({ campaignId, delayHours, subjectTemplate, bodyTemplate }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    await requireOwnedCampaign(businessId, employeeId, campaignId);
    const stepId = await addSequenceStep(businessId, campaignId, {
      delayHours,
      subjectTemplate: subjectTemplate ?? null,
      bodyTemplate,
    });
    return { success: true, stepId };
  },
});

export const summarizeCampaignTool = createTool({
  id: "summarize-campaign",

  description:
    "Summarize a campaign: its status, sequence steps, and recipient counts by state. Use this before describing a campaign's setup to the user, instead of guessing at what has already been configured.",

  inputSchema: z.object({
    campaignId: z.string().min(1),
  }),

  execute: async ({ campaignId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    const campaign = await requireOwnedCampaign(businessId, employeeId, campaignId);
    const steps = await listSequenceSteps(businessId, campaignId);

    const recipients = await db
      .select({ status: outreachCampaignRecipients.status })
      .from(outreachCampaignRecipients)
      .where(eq(outreachCampaignRecipients.campaignId, campaignId));

    const recipientCountsByStatus: Record<string, number> = {};
    for (const recipient of recipients) {
      recipientCountsByStatus[recipient.status] = (recipientCountsByStatus[recipient.status] ?? 0) + 1;
    }

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channel: campaign.channel,
      },
      sequenceStepCount: steps.length,
      totalRecipients: recipients.length,
      recipientCountsByStatus,
    };
  },
});

export const inspectCampaignPerformanceTool = createTool({
  id: "inspect-campaign-performance",

  description:
    "Read a campaign's real delivery performance: send counts by outcome (sent/failed/dead_letter/etc.), and recipient reply/interest/handoff counts. Use this before making any claim about how a launched campaign is performing — never estimate or infer results.",

  inputSchema: z.object({
    campaignId: z.string().min(1),
  }),

  execute: async ({ campaignId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    await requireOwnedCampaign(businessId, employeeId, campaignId);

    const sends = await db
      .select({ status: outreachCampaignSends.status })
      .from(outreachCampaignSends)
      .where(and(eq(outreachCampaignSends.campaignId, campaignId), eq(outreachCampaignSends.businessId, businessId)));

    const sendCountsByStatus: Record<string, number> = {};
    for (const send of sends) {
      sendCountsByStatus[send.status] = (sendCountsByStatus[send.status] ?? 0) + 1;
    }

    const recipients = await db
      .select({ status: outreachCampaignRecipients.status })
      .from(outreachCampaignRecipients)
      .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.businessId, businessId)));

    const repliedCount = recipients.filter((r) => r.status === "replied" || r.status === "interested" || r.status === "handed_off").length;
    const handedOffCount = recipients.filter((r) => r.status === "handed_off").length;

    return {
      sendCountsByStatus,
      totalRecipients: recipients.length,
      repliedCount,
      handedOffCount,
    };
  },
});
