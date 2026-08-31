import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployees,
  leads,
  outreachContacts,
  outreachProspects,
  outreachResearchEvidence,
} from "@/db/schema";
import {
  requireBusinessId,
  requireEmployeeId,
} from "./business-context";
import { createAuditLog } from "@/lib/auth/audit";

export const promoteOutreachProspectToSalesTool = createTool({
  id: "promote-outreach-prospect-to-sales",

  description:
    "Promote an already-qualified Outreach prospect into the current business's Sales pipeline. Only use this after qualification. Nurture, unqualified, or disqualified prospects must never be promoted. This creates or returns one Sales lead and records the Outreach-to-Sales handoff.",

  inputSchema: z.object({
    prospectId: z
      .string()
      .min(1)
      .describe("The qualified Outreach prospect ID."),

    recommendedNextAction: z
      .string()
      .min(10)
      .max(1500)
      .describe(
        "A concise recommended next action for Sales, grounded in the saved research and qualification.",
      ),
  }),

  execute: async (
    {
      prospectId,
      recommendedNextAction,
    },
    { requestContext },
  ) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    const prospect = (
      await db
        .select({
          id: outreachProspects.id,
          companyName: outreachProspects.companyName,
          website: outreachProspects.website,
          industry: outreachProspects.industry,
          country: outreachProspects.country,
          city: outreachProspects.city,
          description: outreachProspects.description,
          employeeId: outreachProspects.employeeId,
          researchStatus: outreachProspects.researchStatus,
          qualificationStatus:
            outreachProspects.qualificationStatus,
          icpFitScore: outreachProspects.icpFitScore,
          qualificationReason:
            outreachProspects.qualificationReason,
          promotedLeadId:
            outreachProspects.promotedLeadId,
        })
        .from(outreachProspects)
        .where(
          and(
            eq(outreachProspects.id, prospectId),
            eq(outreachProspects.businessId, businessId),
          ),
        )
        .limit(1)
    )[0];

    if (!prospect) {
      return {
        success: false,
        error:
          "Outreach prospect not found for the current business.",
      };
    }

    if (prospect.employeeId !== employeeId) {
      return {
        success: false,
        error:
          "This prospect does not belong to the active Outreach employee.",
      };
    }

    if (prospect.promotedLeadId) {
      const existingLead = (
        await db
          .select({
            id: leads.id,
            name: leads.name,
            email: leads.email,
            phone: leads.phone,
            source: leads.source,
            stage: leads.stage,
            assignedEmployeeId:
              leads.assignedEmployeeId,
          })
          .from(leads)
          .where(
            and(
              eq(leads.id, prospect.promotedLeadId),
              eq(leads.businessId, businessId),
            ),
          )
          .limit(1)
      )[0];

      return {
        success: true,
        created: false,
        deduplicated: true,
        alreadyPromoted: true,
        lead: existingLead || {
          id: prospect.promotedLeadId,
        },
      };
    }

    /*
     * AUTHORITY GATE
     *
     * Qualification can happen autonomously, but handing a prospect to
     * Sales is a further commercial commitment. It may only happen
     * autonomously when the business has explicitly configured this
     * Outreach employee's autonomy to "autonomous" via the existing
     * AI-employee supervision-mode settings
     * (app/api/ai-employees/[id]/permissions/route.ts). Any other mode
     * (the "owner_supervised" default, "assistant", or "operator") leaves
     * the prospect qualified-and-ready but requires a human to promote it.
     */
    const outreachEmployee = (
      await db
        .select({
          supervisionMode: aiEmployees.supervisionMode,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.id, employeeId),
            eq(aiEmployees.businessId, businessId),
          ),
        )
        .limit(1)
    )[0];

    if (outreachEmployee?.supervisionMode !== "autonomous") {
      return {
        success: false,
        error:
          "Sales promotion requires this Outreach employee's autonomy to be set to \"autonomous\" in AI employee settings. The prospect remains qualified; promote it manually or update the employee's autonomy level.",
        code: "PROMOTION_REQUIRES_AUTONOMY",
      };
    }

    if (
      prospect.qualificationStatus !== "qualified"
    ) {
      return {
        success: false,
        error:
          `Only qualified prospects can be promoted to Sales. Current status: ${prospect.qualificationStatus}.`,
      };
    }

    if (
      prospect.icpFitScore === null ||
      prospect.icpFitScore < 70
    ) {
      return {
        success: false,
        error:
          "Sales promotion requires an ICP fit score of at least 70.",
      };
    }

    if (prospect.researchStatus !== "researched") {
      return {
        success: false,
        error:
          "Sales promotion requires completed prospect research.",
      };
    }

    const evidence = await db
      .select({
        claim: outreachResearchEvidence.claim,
        classification:
          outreachResearchEvidence.classification,
        sourceUrl:
          outreachResearchEvidence.sourceUrl,
        sourceTier:
          outreachResearchEvidence.sourceTier,
        buyingSignalType:
          outreachResearchEvidence.buyingSignalType,
        buyingSignalStrength:
          outreachResearchEvidence.buyingSignalStrength,
      })
      .from(outreachResearchEvidence)
      .where(
        and(
          eq(
            outreachResearchEvidence.businessId,
            businessId,
          ),
          eq(
            outreachResearchEvidence.prospectId,
            prospectId,
          ),
          eq(
            outreachResearchEvidence.employeeId,
            employeeId,
          ),
        ),
      );

    if (evidence.length === 0) {
      return {
        success: false,
        error:
          "Sales promotion requires saved Outreach research evidence.",
      };
    }

    const contacts = await db
      .select({
        name: outreachContacts.name,
        jobTitle: outreachContacts.jobTitle,
        email: outreachContacts.email,
        phone: outreachContacts.phone,
        contactPageUrl:
          outreachContacts.contactPageUrl,
        contactType:
          outreachContacts.contactType,
        verificationStatus:
          outreachContacts.verificationStatus,
        doNotContact:
          outreachContacts.doNotContact,
      })
      .from(outreachContacts)
      .where(
        and(
          eq(outreachContacts.businessId, businessId),
          eq(outreachContacts.prospectId, prospectId),
        ),
      );

    const usableContacts = contacts.filter(
      (contact) => !contact.doNotContact,
    );

    const primaryContact =
      usableContacts.find(
        (contact) =>
          contact.verificationStatus ===
            "verified_public" &&
          (contact.email || contact.phone),
      ) ||
      usableContacts.find(
        (contact) =>
          contact.verificationStatus ===
          "verified_public",
      ) ||
      usableContacts[0];

    const salesEmployee = (
      await db
        .select({
          id: aiEmployees.id,
          name: aiEmployees.name,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.businessId, businessId),
            eq(aiEmployees.type, "sales"),
            eq(aiEmployees.status, "active"),
          ),
        )
        .limit(1)
    )[0];

    const evidenceSummary = evidence
      .slice(0, 10)
      .map((item, index) => {
        const source =
          item.sourceUrl
            ? ` Source: ${item.sourceUrl}`
            : "";

        const signal =
          item.buyingSignalType
            ? ` Buying signal: ${item.buyingSignalType}${
                item.buyingSignalStrength
                  ? ` (${item.buyingSignalStrength})`
                  : ""
              }.`
            : "";

        return `${index + 1}. [${item.classification}] ${item.claim}.${source}${signal}`;
      })
      .join("\n");

    const notes = [
      "OUTREACH TO SALES HANDOFF",
      "",
      `Company: ${prospect.companyName}`,
      `Website: ${prospect.website || "Unknown"}`,
      `Industry: ${prospect.industry || "Unknown"}`,
      `Location: ${
        [prospect.city, prospect.country]
          .filter(Boolean)
          .join(", ") || "Unknown"
      }`,
      "",
      `ICP fit score: ${prospect.icpFitScore}/100`,
      `Qualification: ${prospect.qualificationReason || "No reason recorded"}`,
      "",
      "Research evidence:",
      evidenceSummary || "No evidence summary available.",
      "",
      "Public contact:",
      primaryContact
        ? [
            primaryContact.name
              ? `Name: ${primaryContact.name}`
              : null,
            primaryContact.jobTitle
              ? `Role: ${primaryContact.jobTitle}`
              : null,
            primaryContact.email
              ? `Email: ${primaryContact.email}`
              : null,
            primaryContact.phone
              ? `Phone: ${primaryContact.phone}`
              : null,
            primaryContact.contactPageUrl
              ? `Contact page: ${primaryContact.contactPageUrl}`
              : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "No usable public contact saved.",
      "",
      `Recommended next action: ${recommendedNextAction.trim()}`,
    ].join("\n");

    const now = new Date();
    const leadId = crypto.randomUUID();

    const promotionResult = await db.transaction(async (tx) => {
      const claimedProspect = (
        await tx
          .update(outreachProspects)
          .set({
            promotedLeadId: leadId,
            promotedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(outreachProspects.id, prospectId),
              eq(outreachProspects.businessId, businessId),
              eq(outreachProspects.employeeId, employeeId),
              isNull(outreachProspects.promotedLeadId),
            ),
          )
          .returning({
            id: outreachProspects.id,
          })
      )[0];

      if (!claimedProspect) {
        const alreadyPromoted = (
          await tx
            .select({
              promotedLeadId: outreachProspects.promotedLeadId,
            })
            .from(outreachProspects)
            .where(
              and(
                eq(outreachProspects.id, prospectId),
                eq(outreachProspects.businessId, businessId),
                eq(outreachProspects.employeeId, employeeId),
              ),
            )
            .limit(1)
        )[0];

        return {
          created: false as const,
          existingLeadId:
            alreadyPromoted?.promotedLeadId || null,
          lead: null,
        };
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
            intent: "outreach_qualified_prospect",
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

            assignedEmployeeId:
              salesEmployee?.id || null,

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
            assignedEmployeeId:
              leads.assignedEmployeeId,
          })
      )[0];

      if (!createdLead) {
        throw new Error(
          "Failed to create Sales lead during Outreach promotion.",
        );
      }

      return {
        created: true as const,
        existingLeadId: null,
        lead: createdLead,
      };
    });

    if (!promotionResult.created) {
      const existingLead = promotionResult.existingLeadId
        ? (
            await db
              .select({
                id: leads.id,
                name: leads.name,
                email: leads.email,
                phone: leads.phone,
                source: leads.source,
                stage: leads.stage,
                assignedEmployeeId:
                  leads.assignedEmployeeId,
              })
              .from(leads)
              .where(
                and(
                  eq(leads.id, promotionResult.existingLeadId),
                  eq(leads.businessId, businessId),
                ),
              )
              .limit(1)
          )[0]
        : null;

      return {
        success: true,
        created: false,
        deduplicated: true,
        alreadyPromoted: true,
        lead:
          existingLead ||
          (promotionResult.existingLeadId
            ? { id: promotionResult.existingLeadId }
            : null),
      };
    }

    const createdLead = promotionResult.lead;

    await createAuditLog({
      businessId,
      userId: null,
      action:
        "ai.outreach.prospect.promoted_to_sales",
      resource: "outreach_prospect",
      resourceId: prospectId,
      description:
        `Kuba Outreach promoted "${prospect.companyName}" to Sales.`,
      metadata: {
        employeeId,
        salesLeadId: leadId,
        assignedSalesEmployeeId:
          salesEmployee?.id || null,
        icpFitScore: prospect.icpFitScore,
        evidenceCount: evidence.length,
        usableContactCount:
          usableContacts.length,
      },
    });

    return {
      success: true,
      created: true,
      deduplicated: false,
      alreadyPromoted: false,
      lead: createdLead,
      handoff: {
        prospectId,
        companyName: prospect.companyName,
        icpFitScore: prospect.icpFitScore,
        assignedSalesEmployee:
          salesEmployee || null,
        evidenceCount: evidence.length,
        usableContactCount:
          usableContacts.length,
      },
    };
  },
});
