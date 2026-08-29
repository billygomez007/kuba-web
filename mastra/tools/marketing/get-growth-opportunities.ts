import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, followUps, customers } from "@/db/schema";
import { requireBusinessId } from "@/mastra/tools/business-context";
import { requireMarketingFeature } from "./entitlement";

export type GrowthOpportunity = {
  opportunity: string;
  evidence: string;
  suggestedAction: string;
  expectedObjective: string;
  requiredChannel: string;
  approvalRequired: boolean;
  confidence: "low" | "medium" | "high";
};

type LeadRow = {
  id: string;
  name: string | null;
  service: string | null;
  stage: string;
  source: string | null;
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
};

type FollowUpRow = {
  id: string;
  leadId: string;
  status: string;
  dueAt: Date | string | number;
};

type CustomerRow = {
  id: string;
  updatedAt: Date | string | number;
};

/**
 * Pure signal-detection logic, kept separate from the DB read so it can be
 * exercised directly in tests without a database. Every opportunity here is
 * derived strictly from counts in the input arrays — nothing is invented.
 */
export function computeGrowthOpportunities(
  leadRows: LeadRow[],
  followUpRows: FollowUpRow[],
  customerRows: CustomerRow[],
  now: Date = new Date(),
): GrowthOpportunity[] {
  const opportunities: GrowthOpportunity[] = [];
  const nowMs = now.getTime();
  const day = 24 * 60 * 60 * 1000;

  const uncontacted = leadRows.filter((lead) => lead.stage === "new");
  if (uncontacted.length > 0) {
    opportunities.push({
      opportunity: `${uncontacted.length} new lead(s) have not yet been contacted.`,
      evidence: `${uncontacted.length} lead(s) in stage "new".`,
      suggestedAction: "Launch a first-contact / welcome sequence for new leads.",
      expectedObjective: "Move new leads to contacted before they go cold.",
      requiredChannel: "WhatsApp, SMS, or email (requires approval to send)",
      approvalRequired: true,
      confidence: "high",
    });
  }

  const staleLeads = leadRows.filter(
    (lead) =>
      lead.stage !== "converted" &&
      nowMs - new Date(lead.updatedAt).getTime() > 14 * day,
  );
  if (staleLeads.length > 0) {
    opportunities.push({
      opportunity: `${staleLeads.length} open lead(s) have had no activity in over 14 days.`,
      evidence: `${staleLeads.length} lead(s) not in stage "converted" with no update in 14+ days.`,
      suggestedAction: "Create a re-engagement nurture sequence for stalled leads.",
      expectedObjective: "Revive stalled pipeline opportunities.",
      requiredChannel: "Email or WhatsApp (requires approval to send)",
      approvalRequired: true,
      confidence: "medium",
    });
  }

  const overdueFollowUps = followUpRows.filter(
    (followUp) =>
      followUp.status === "pending" &&
      new Date(followUp.dueAt).getTime() < nowMs,
  );
  if (overdueFollowUps.length > 0) {
    opportunities.push({
      opportunity: `${overdueFollowUps.length} follow-up(s) are overdue.`,
      evidence: `${overdueFollowUps.length} follow-up(s) with status "pending" and a past due date.`,
      suggestedAction: "Coordinate with Sales to close out overdue follow-ups before starting new outreach.",
      expectedObjective: "Protect leads already in motion from going cold.",
      requiredChannel: "Internal handoff to Sales",
      approvalRequired: false,
      confidence: "high",
    });
  }

  const serviceCounts: Record<string, number> = {};
  for (const lead of leadRows) {
    if (!lead.service) continue;
    serviceCounts[lead.service] = (serviceCounts[lead.service] || 0) + 1;
  }
  const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];
  if (topService && topService[1] >= 3) {
    opportunities.push({
      opportunity: `Strong lead interest in "${topService[0]}" (${topService[1]} leads).`,
      evidence: `${topService[1]} lead(s) recorded with service "${topService[0]}".`,
      suggestedAction: `Create a focused campaign or content series promoting "${topService[0]}".`,
      expectedObjective: "Convert demonstrated demand into more qualified leads.",
      requiredChannel: "Content / social / email (draft only)",
      approvalRequired: false,
      confidence: "medium",
    });
  }

  const sourceCounts: Record<string, number> = {};
  for (const lead of leadRows) {
    const key = lead.source || "unknown";
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  }
  const sourceEntries = Object.entries(sourceCounts);
  if (sourceEntries.length > 1) {
    const weakest = sourceEntries.sort((a, b) => a[1] - b[1])[0];
    const strongest = sourceEntries.sort((a, b) => b[1] - a[1])[0];
    if (strongest[1] >= weakest[1] * 3 && strongest[1] >= 3) {
      opportunities.push({
        opportunity: `Lead sources are concentrated: "${strongest[0]}" produces most leads, "${weakest[0]}" produces few.`,
        evidence: `${strongest[0]}: ${strongest[1]} lead(s); ${weakest[0]}: ${weakest[1]} lead(s).`,
        suggestedAction: `Investigate whether "${weakest[0]}" is underused and worth a dedicated content push.`,
        expectedObjective: "Diversify lead generation away from a single channel.",
        requiredChannel: "Content / social (draft only)",
        approvalRequired: false,
        confidence: "low",
      });
    }
  }

  const dormantCustomers = customerRows.filter(
    (customer) => nowMs - new Date(customer.updatedAt).getTime() > 90 * day,
  );
  if (dormantCustomers.length > 0) {
    opportunities.push({
      opportunity: `${dormantCustomers.length} customer(s) have not engaged in over 90 days.`,
      evidence: `${dormantCustomers.length} customer record(s) with no update in 90+ days.`,
      suggestedAction: "Draft a reactivation campaign for dormant customers.",
      expectedObjective: "Recover revenue from existing customers before acquiring new ones.",
      requiredChannel: "Email or WhatsApp (requires approval to send)",
      approvalRequired: true,
      confidence: "medium",
    });
  }

  return opportunities;
}

export const getGrowthOpportunitiesTool = createTool({
  id: "get-growth-opportunities",

  description:
    "Analyze real leads, follow-ups, and customer records for this business to identify concrete growth opportunities. Every opportunity is backed by evidence from the data — never invented. Use this when the user asks to find growth opportunities, marketing opportunities, or where the business is losing leads.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const businessId = requireBusinessId(requestContext);

    const [leadRows, followUpRows, customerRows] = await Promise.all([
      db
        .select({
          id: leads.id,
          name: leads.name,
          service: leads.service,
          stage: leads.stage,
          source: leads.source,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt,
        })
        .from(leads)
        .where(eq(leads.businessId, businessId)),
      db
        .select({
          id: followUps.id,
          leadId: followUps.leadId,
          status: followUps.status,
          dueAt: followUps.dueAt,
        })
        .from(followUps)
        .where(eq(followUps.businessId, businessId)),
      db
        .select({ id: customers.id, updatedAt: customers.updatedAt })
        .from(customers)
        .where(eq(customers.businessId, businessId)),
    ]);

    const opportunities = computeGrowthOpportunities(leadRows, followUpRows, customerRows);

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      dataSources: {
        leadsAnalyzed: leadRows.length,
        followUpsAnalyzed: followUpRows.length,
        customersAnalyzed: customerRows.length,
      },
      opportunities,
      message:
        opportunities.length === 0
          ? "No growth opportunities were detected from current lead, follow-up, and customer data."
          : `Found ${opportunities.length} growth opportunit${opportunities.length === 1 ? "y" : "ies"} from real business data.`,
    };
  },
});
