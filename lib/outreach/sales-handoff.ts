import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployees, leads, outreachContacts, outreachProspects, outreachResearchEvidence } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";

/**
 * The deterministic core of every Outreach -> Sales handoff, regardless of
 * what triggered it (approved spec, section 10/22). Two triggers converge
 * into this SAME function rather than each having their own lead-creation
 * logic:
 *
 *  - "autonomous_research_qualification": mastra/tools/promote-outreach-
 *    prospect-to-sales.ts, gated by its own preconditions (qualification
 *    status, ICP fit score >= 70, saved research evidence, and the
 *    employee's autonomy explicitly set to "autonomous") — those
 *    preconditions exist specifically for autonomous AI-initiated
 *    promotion and are NOT re-applied here.
 *  - "campaign_reply_engagement": lib/outreach/campaign-reply-handoff.ts
 *    (not yet wired to a live trigger — inbound reply correlation is
 *    blocked on a DNS/receiving-domain decision, see CURRENT_STATE.md). A
 *    real reply is direct engagement evidence in its own right and is not
 *    forced through the ICP-score rule that exists for the passive
 *    research-qualification path.
 *
 * Idempotency: exactly-once per prospect, enforced by the same atomic
 * claim (UPDATE ... WHERE promoted_lead_id IS NULL) either trigger would
 * otherwise have to duplicate — whichever reason reaches this function
 * first for a given prospect wins, and every subsequent call (from either
 * trigger) is told the prospect is already promoted rather than creating a
 * second lead.
 */

export type HandoffReason =
  | { type: "autonomous_research_qualification"; icpFitScore: number; qualificationReason: string | null }
  | { type: "campaign_reply_engagement"; campaignId: string; recipientId: string; replySummary: string };

export interface HandoffLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  assignedEmployeeId: string | null;
}

export type HandoffResult =
  | { success: true; created: true; deduplicated: false; lead: HandoffLead }
  | { success: true; created: false; deduplicated: true; lead: HandoffLead | { id: string } }
  | { success: false; error: string };

function buildHandoffNotes(
  prospect: {
    companyName: string;
    website: string | null;
    industry: string | null;
    country: string | null;
    city: string | null;
  },
  reason: HandoffReason,
  evidenceSummary: string,
  primaryContact: { name: string | null; jobTitle: string | null; email: string | null; phone: string | null; contactPageUrl: string | null } | undefined,
  recommendedNextAction: string,
): string {
  const reasonBlock =
    reason.type === "autonomous_research_qualification"
      ? [
          `Trigger: Autonomous Outreach research qualification`,
          `ICP fit score: ${reason.icpFitScore}/100`,
          `Qualification: ${reason.qualificationReason || "No reason recorded"}`,
        ].join("\n")
      : [
          `Trigger: Campaign reply/engagement`,
          `Campaign ID: ${reason.campaignId}`,
          `Recipient ID: ${reason.recipientId}`,
          `Reply summary: ${reason.replySummary}`,
        ].join("\n");

  return [
    "OUTREACH TO SALES HANDOFF",
    "",
    `Company: ${prospect.companyName}`,
    `Website: ${prospect.website || "Unknown"}`,
    `Industry: ${prospect.industry || "Unknown"}`,
    `Location: ${[prospect.city, prospect.country].filter(Boolean).join(", ") || "Unknown"}`,
    "",
    reasonBlock,
    "",
    "Research evidence:",
    evidenceSummary || "No evidence summary available.",
    "",
    "Public contact:",
    primaryContact
      ? [
          primaryContact.name ? `Name: ${primaryContact.name}` : null,
          primaryContact.jobTitle ? `Role: ${primaryContact.jobTitle}` : null,
          primaryContact.email ? `Email: ${primaryContact.email}` : null,
          primaryContact.phone ? `Phone: ${primaryContact.phone}` : null,
          primaryContact.contactPageUrl ? `Contact page: ${primaryContact.contactPageUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "No usable public contact saved.",
    "",
    `Recommended next action: ${recommendedNextAction.trim()}`,
  ].join("\n");
}

export async function promoteProspectToSales(params: {
  businessId: string;
  prospectId: string;
  employeeId: string;
  reason: HandoffReason;
  recommendedNextAction: string;
}): Promise<HandoffResult> {
  const { businessId, prospectId, employeeId, reason, recommendedNextAction } = params;

  const prospect = (
    await db
      .select({
        id: outreachProspects.id,
        companyName: outreachProspects.companyName,
        website: outreachProspects.website,
        industry: outreachProspects.industry,
        country: outreachProspects.country,
        city: outreachProspects.city,
        promotedLeadId: outreachProspects.promotedLeadId,
      })
      .from(outreachProspects)
      .where(and(eq(outreachProspects.id, prospectId), eq(outreachProspects.businessId, businessId)))
      .limit(1)
  )[0];

  if (!prospect) {
    return { success: false, error: "Outreach prospect not found for the current business." };
  }

  if (prospect.promotedLeadId) {
    const existingLead = await loadLead(businessId, prospect.promotedLeadId);
    return { success: true, created: false, deduplicated: true, lead: existingLead || { id: prospect.promotedLeadId } };
  }

  const evidence = await db
    .select({
      claim: outreachResearchEvidence.claim,
      classification: outreachResearchEvidence.classification,
      sourceUrl: outreachResearchEvidence.sourceUrl,
      buyingSignalType: outreachResearchEvidence.buyingSignalType,
      buyingSignalStrength: outreachResearchEvidence.buyingSignalStrength,
    })
    .from(outreachResearchEvidence)
    .where(and(eq(outreachResearchEvidence.businessId, businessId), eq(outreachResearchEvidence.prospectId, prospectId)));

  const evidenceSummary = evidence
    .slice(0, 10)
    .map((item, index) => {
      const source = item.sourceUrl ? ` Source: ${item.sourceUrl}` : "";
      const signal = item.buyingSignalType
        ? ` Buying signal: ${item.buyingSignalType}${item.buyingSignalStrength ? ` (${item.buyingSignalStrength})` : ""}.`
        : "";
      return `${index + 1}. [${item.classification}] ${item.claim}.${source}${signal}`;
    })
    .join("\n");

  const contacts = await db
    .select({
      name: outreachContacts.name,
      jobTitle: outreachContacts.jobTitle,
      email: outreachContacts.email,
      phone: outreachContacts.phone,
      contactPageUrl: outreachContacts.contactPageUrl,
      verificationStatus: outreachContacts.verificationStatus,
      doNotContact: outreachContacts.doNotContact,
    })
    .from(outreachContacts)
    .where(and(eq(outreachContacts.businessId, businessId), eq(outreachContacts.prospectId, prospectId)));

  const usableContacts = contacts.filter((contact) => !contact.doNotContact);
  const primaryContact =
    usableContacts.find((contact) => contact.verificationStatus === "verified_public" && (contact.email || contact.phone)) ||
    usableContacts.find((contact) => contact.verificationStatus === "verified_public") ||
    usableContacts[0];

  const salesEmployee = (
    await db
      .select({ id: aiEmployees.id, name: aiEmployees.name })
      .from(aiEmployees)
      .where(and(eq(aiEmployees.businessId, businessId), eq(aiEmployees.type, "sales"), eq(aiEmployees.status, "active")))
      .limit(1)
  )[0];

  const notes = buildHandoffNotes(prospect, reason, evidenceSummary, primaryContact, recommendedNextAction);
  const now = new Date();
  const leadId = crypto.randomUUID();

  const promotionResult = await db.transaction(async (tx) => {
    const claimedProspect = (
      await tx
        .update(outreachProspects)
        .set({ promotedLeadId: leadId, promotedAt: now, updatedAt: now })
        .where(and(eq(outreachProspects.id, prospectId), eq(outreachProspects.businessId, businessId), isNull(outreachProspects.promotedLeadId)))
        .returning({ id: outreachProspects.id })
    )[0];

    if (!claimedProspect) {
      const alreadyPromoted = (
        await tx
          .select({ promotedLeadId: outreachProspects.promotedLeadId })
          .from(outreachProspects)
          .where(and(eq(outreachProspects.id, prospectId), eq(outreachProspects.businessId, businessId)))
          .limit(1)
      )[0];
      return { created: false as const, existingLeadId: alreadyPromoted?.promotedLeadId || null };
    }

    const createdLead = (
      await tx
        .insert(leads)
        .values({
          id: leadId,
          businessId,
          customerId: null,
          name: prospect.companyName,
          email: primaryContact?.email || null,
          phone: primaryContact?.phone || null,
          service: null,
          destination: null,
          intent: reason.type === "autonomous_research_qualification" ? "outreach_qualified_prospect" : "outreach_campaign_reply",
          notes,
          studyLevel: null,
          program: null,
          university: null,
          preferredIntake: null,
          budget: null,
          source: "kuba_outreach",
          stage: "new",
          estimatedValue: null,
          currency: "GHS",
          dealStatus: "open",
          closedAt: null,
          assignedEmployeeId: salesEmployee?.id || null,
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
          assignedEmployeeId: leads.assignedEmployeeId,
        })
    )[0];

    if (!createdLead) {
      throw new Error("Failed to create Sales lead during Outreach handoff.");
    }

    return { created: true as const, lead: createdLead };
  });

  if (!promotionResult.created) {
    const existingLead = promotionResult.existingLeadId ? await loadLead(businessId, promotionResult.existingLeadId) : null;
    return {
      success: true,
      created: false,
      deduplicated: true,
      lead: existingLead || (promotionResult.existingLeadId ? { id: promotionResult.existingLeadId } : { id: leadId }),
    };
  }

  await createAuditLog({
    businessId,
    userId: null,
    action: reason.type === "autonomous_research_qualification" ? "ai.outreach.prospect.promoted_to_sales" : "outreach.campaign_reply.promoted_to_sales",
    resource: "outreach_prospect",
    resourceId: prospectId,
    description: `Kuba Outreach promoted "${prospect.companyName}" to Sales (${reason.type}).`,
    metadata: {
      employeeId,
      salesLeadId: leadId,
      assignedSalesEmployeeId: salesEmployee?.id || null,
      reasonType: reason.type,
      evidenceCount: evidence.length,
      usableContactCount: usableContacts.length,
    },
  });

  return { success: true, created: true, deduplicated: false, lead: promotionResult.lead };
}

async function loadLead(businessId: string, leadId: string): Promise<HandoffLead | null> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      source: leads.source,
      stage: leads.stage,
      assignedEmployeeId: leads.assignedEmployeeId,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.businessId, businessId)))
    .limit(1);
  return rows[0] || null;
}
