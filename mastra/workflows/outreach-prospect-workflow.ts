import { z } from "zod";
import { and, eq } from "drizzle-orm";

import {
  createStep,
  createWorkflow,
} from "@mastra/core/workflows";

import { db } from "@/db";
import {
  outreachContacts,
  outreachProspects,
  outreachResearchEvidence,
} from "@/db/schema";

import { saveOutreachProspectTool } from "@/mastra/tools/save-outreach-prospect";
import { saveOutreachEvidenceTool } from "@/mastra/tools/save-outreach-evidence";
import { saveOutreachContactTool } from "@/mastra/tools/save-outreach-contact";
import { qualifyOutreachProspectTool } from "@/mastra/tools/qualify-outreach-prospect";

import {
  requireBusinessId,
  requireEmployeeId,
} from "@/mastra/tools/business-context";

import { outreachResearchPackageSchema } from "@/mastra/schemas/outreach-research-package";

/*
 * The research package schema allows `null` on optional fields (see
 * mastra/schemas/outreach-research-package.ts for why: OpenAI's structured
 * output otherwise forces the model to invent a value rather than admit it
 * doesn't know one). The save/qualify tool input schemas were already
 * tested and shipped using plain `.optional()` (undefined-only) and are not
 * touched here. This normalizes `null` -> `undefined` at the boundary
 * between the two, so a truthful "unknown" from the research package
 * doesn't fail tool input validation.
 */
function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

/*
 * The research package's `observedAt` is a free-form string (see
 * mastra/schemas/outreach-research-package.ts) because the model
 * legitimately observes dates in many shapes ("2023-10-10", not always a
 * full timestamp). saveOutreachEvidenceTool's own input schema requires a
 * strict ISO datetime and is untouched here. A date that fails to parse is
 * dropped (undefined) rather than fabricated into a fake timestamp.
 */
function normalizeObservedAt(
  value: string | null | undefined,
): string | undefined {
  const raw = nullToUndefined(value);

  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed.toISOString();
}

const trustedContextSchema = z.object({
  businessId: z.string().min(1),
  employeeId: z.string().min(1),
});

/*
 * prospect / evidence / contact / qualification input shapes live in
 * mastra/schemas/outreach-research-package.ts so the research-only agent
 * and this deterministic persistence workflow always share one contract.
 */
const workflowInputSchema = outreachResearchPackageSchema;

type WorkflowInput =
  z.infer<typeof workflowInputSchema>;

const workflowOutputSchema = z.object({
  success: z.boolean(),

  status: z.enum([
    "completed",
    "partial",
    "failed",
  ]),

  prospectId: z.string().nullable(),
  evidenceIds: z.array(z.string()),
  evidenceCount: z.number().int().nonnegative(),
  contactId: z.string().nullable(),

  prospectPersisted: z.boolean(),
  evidencePersisted: z.boolean(),

  contactPersisted: z.boolean(),
  contactUnavailable: z.boolean(),

  qualificationPersisted: z.boolean(),

  qualificationStatus: z
    .enum([
      "qualified",
      "nurture",
      "disqualified",
    ])
    .nullable(),

  icpFitScore: z.number().nullable(),

  message: z.string(),
});

const initializeStep = createStep({
  id: "initialize-outreach-persistence",

  inputSchema: workflowInputSchema,

  outputSchema: workflowInputSchema,

  requestContextSchema: trustedContextSchema,

  execute: async ({
    inputData,
    requestContext,
  }) => {
    requireBusinessId(requestContext);
    requireEmployeeId(requestContext);

    return inputData;
  },
});

const saveProspectStep =
  createStep(saveOutreachProspectTool);

const saveEvidenceStep =
  createStep(saveOutreachEvidenceTool);

const saveContactStep =
  createStep(saveOutreachContactTool);

const qualifyProspectStep =
  createStep(qualifyOutreachProspectTool);

const finalVerificationStep = createStep({
  id: "verify-complete-outreach-workflow",

  inputSchema: z.union([
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),

    z.object({
      success: z.literal(true),

      prospect: z
        .object({
          id: z.string(),
        })
        .passthrough(),

      qualification: z.object({
        status: z.enum([
          "qualified",
          "nurture",
          "disqualified",
        ]),

        icpFitScore: z
          .number()
          .int()
          .min(0)
          .max(100),

        reason: z.string(),

        evidenceCount:
          z.number().int().nonnegative(),

        confirmedEvidenceCount:
          z.number().int().nonnegative(),

        strongEvidenceCount:
          z.number().int().nonnegative(),

        credibleBuyingSignalCount:
          z.number().int().nonnegative(),
      }),
    }),
  ]),

  outputSchema: workflowOutputSchema,

  requestContextSchema: trustedContextSchema,

  execute: async ({
    inputData,
    requestContext,
    getInitData,
    getStepResult,
  }) => {
    const businessId =
      requireBusinessId(requestContext);

    const employeeId =
      requireEmployeeId(requestContext);

    const initData =
      getInitData<WorkflowInput>();

    const prospectResult =
      getStepResult(saveProspectStep);

    const evidenceResults =
      getStepResult(saveEvidenceStep);

    if (!prospectResult?.success) {
      return {
        success: false,
        status: "failed" as const,

        prospectId: null,
        evidenceIds: [],
        evidenceCount: 0,
        contactId: null,

        prospectPersisted: false,
        evidencePersisted: false,

        contactPersisted: false,
        contactUnavailable:
          !initData.contact.available,

        qualificationPersisted: false,

        qualificationStatus: null,
        icpFitScore: null,

        message:
          "Prospect persistence could not be verified.",
      };
    }

    const prospectId =
      prospectResult.prospect.id;

    const allEvidenceSucceeded =
      Array.isArray(evidenceResults) &&
      evidenceResults.length ===
        initData.evidence.length &&
      evidenceResults.every(
        (item) => item?.success,
      );

    const evidenceIds =
      Array.isArray(evidenceResults)
        ? evidenceResults
            .filter(
              (
                item,
              ): item is Extract<
                (typeof evidenceResults)[number],
                { success: true }
              > => item?.success === true,
            )
            .map((item) => item.evidence.id)
        : [];

    if (!allEvidenceSucceeded) {
      return {
        success: false,
        status: "partial" as const,

        prospectId,
        evidenceIds,
        evidenceCount: evidenceIds.length,
        contactId: null,

        prospectPersisted: true,
        evidencePersisted: false,

        contactPersisted: false,
        contactUnavailable:
          !initData.contact.available,

        qualificationPersisted: false,

        qualificationStatus: null,
        icpFitScore: null,

        message:
          "Prospect was persisted, but one or more research evidence records could not be verified.",
      };
    }

    const prospectRows = await db
      .select()
      .from(outreachProspects)
      .where(
        and(
          eq(
            outreachProspects.id,
            prospectId,
          ),
          eq(
            outreachProspects.businessId,
            businessId,
          ),
          eq(
            outreachProspects.employeeId,
            employeeId,
          ),
        ),
      )
      .limit(1);

    const evidenceRows = await db
      .select({
        id: outreachResearchEvidence.id,
      })
      .from(outreachResearchEvidence)
      .where(
        and(
          eq(
            outreachResearchEvidence.prospectId,
            prospectId,
          ),
          eq(
            outreachResearchEvidence.businessId,
            businessId,
          ),
          eq(
            outreachResearchEvidence.employeeId,
            employeeId,
          ),
        ),
      );

    const persistedEvidenceIds =
      new Set(
        evidenceRows.map((row) => row.id),
      );

    const everyEvidenceVerified =
      evidenceIds.length ===
        initData.evidence.length &&
      evidenceIds.every((id) =>
        persistedEvidenceIds.has(id),
      );

    if (
      prospectRows.length !== 1 ||
      !everyEvidenceVerified
    ) {
      return {
        success: false,
        status: "failed" as const,

        prospectId,
        evidenceIds,
        evidenceCount: evidenceIds.length,

        contactId: null,

        prospectPersisted:
          prospectRows.length === 1,

        evidencePersisted:
          everyEvidenceVerified,

        contactPersisted: false,

        contactUnavailable:
          !initData.contact.available,

        qualificationPersisted: false,

        qualificationStatus: null,
        icpFitScore: null,

        message:
          "Final database verification failed for the persisted prospect or evidence.",
      };
    }

    let contactId: string | null = null;
    let contactPersisted = false;

    if (initData.contact.available) {
      const contactRows = await db
        .select()
        .from(outreachContacts)
        .where(
          and(
            eq(
              outreachContacts.businessId,
              businessId,
            ),
            eq(
              outreachContacts.prospectId,
              prospectId,
            ),
            eq(
              outreachContacts.sourceUrl,
              initData.contact.sourceUrl,
            ),
          ),
        )
        .limit(1);

      if (contactRows.length === 1) {
        contactId = contactRows[0].id;
        contactPersisted = true;
      }
    }

    if (!inputData.success) {
      return {
        success: false,
        status: "partial" as const,

        prospectId,
        evidenceIds,
        evidenceCount: evidenceIds.length,
        contactId,

        prospectPersisted: true,
        evidencePersisted: true,

        contactPersisted,

        contactUnavailable:
          !initData.contact.available,

        qualificationPersisted: false,

        qualificationStatus: null,
        icpFitScore: null,

        message:
          `Prospect research was persisted, but qualification was rejected: ${inputData.error}`,
      };
    }

    const verifiedProspect =
      prospectRows[0];

    const qualificationPersisted =
      verifiedProspect.qualificationStatus ===
        inputData.qualification.status &&
      verifiedProspect.icpFitScore ===
        inputData.qualification.icpFitScore;

    if (!qualificationPersisted) {
      return {
        success: false,
        status: "partial" as const,

        prospectId,
        evidenceIds,
        evidenceCount: evidenceIds.length,
        contactId,

        prospectPersisted: true,
        evidencePersisted: true,

        contactPersisted,

        contactUnavailable:
          !initData.contact.available,

        qualificationPersisted: false,

        qualificationStatus:
          inputData.qualification.status,

        icpFitScore:
          inputData.qualification.icpFitScore,

        message:
          "Qualification tool succeeded, but final database verification did not match the tool result.",
      };
    }

    if (
      initData.contact.available &&
      !contactPersisted
    ) {
      return {
        success: false,
        status: "partial" as const,

        prospectId,
        evidenceIds,
        evidenceCount: evidenceIds.length,
        contactId,

        prospectPersisted: true,
        evidencePersisted: true,

        contactPersisted: false,
        contactUnavailable: false,

        qualificationPersisted: true,

        qualificationStatus:
          inputData.qualification.status,

        icpFitScore:
          inputData.qualification.icpFitScore,

        message:
          "Prospect, evidence, and qualification were persisted, but the expected public contact could not be independently verified in the database.",
      };
    }

    return {
      success: true,
      status: "completed" as const,

      prospectId,
      evidenceIds,
      evidenceCount: evidenceIds.length,
      contactId,

      prospectPersisted: true,
      evidencePersisted: true,

      contactPersisted,

      contactUnavailable:
        !initData.contact.available,

      qualificationPersisted: true,

      qualificationStatus:
        inputData.qualification.status,

      icpFitScore:
        inputData.qualification.icpFitScore,

      message:
        initData.contact.available
          ? "Prospect, evidence, public contact, and qualification were persisted and independently verified."
          : "Prospect, evidence, and qualification were persisted and independently verified. No legitimate public contact route was available, so none was fabricated.",
    };
  },
});

export const outreachProspectWorkflow =
  createWorkflow({
    id: "outreach-prospect-workflow",

    description:
      "Deterministic SuperKuba Outreach workflow for prospect persistence, research evidence, optional public contact persistence, qualification, and final database verification.",

    inputSchema: workflowInputSchema,
    outputSchema: workflowOutputSchema,

    requestContextSchema:
      trustedContextSchema,
  })

    .then(initializeStep)

    /*
     * Persist the prospect.
     */
    .map(async ({ inputData }) => ({
      companyName:
        inputData.prospect.companyName,

      website:
        nullToUndefined(inputData.prospect.website),

      industry:
        nullToUndefined(inputData.prospect.industry),

      country:
        nullToUndefined(inputData.prospect.country),

      city:
        nullToUndefined(inputData.prospect.city),

      description:
        nullToUndefined(inputData.prospect.description),

      discoverySource:
        nullToUndefined(inputData.prospect.discoverySource),

      discoveryQuery:
        nullToUndefined(inputData.prospect.discoveryQuery),
    }))

    .then(saveProspectStep)

    /*
     * Persist research evidence using only
     * the REAL prospect ID returned above.
     */
    .map(async ({
      inputData,
      getInitData,
    }) => {
      if (!inputData.success) {
        throw new Error(
          "Prospect persistence did not succeed.",
        );
      }

      const initData =
        getInitData<WorkflowInput>();

      return initData.evidence.map(
        (evidence) => ({
          prospectId:
            inputData.prospect.id,

          findingType:
            evidence.findingType,

          claim:
            evidence.claim,

          classification:
            evidence.classification,

          sourceUrl:
            nullToUndefined(evidence.sourceUrl),

          sourceTitle:
            nullToUndefined(evidence.sourceTitle),

          sourceTier:
            nullToUndefined(evidence.sourceTier),

          sourceType:
            nullToUndefined(evidence.sourceType),

          buyingSignalType:
            nullToUndefined(evidence.buyingSignalType),

          buyingSignalStrength:
            nullToUndefined(evidence.buyingSignalStrength),

          observedAt:
            normalizeObservedAt(evidence.observedAt),
        }),
      );
    })

    .foreach(saveEvidenceStep)

    /*
     * Convert optional contact into a list:
     *
     * available   -> [contact]
     * unavailable -> []
     *
     * foreach therefore executes the contact
     * persistence tool zero or one times.
     */
    .map(async ({
      inputData,
      getInitData,
    }) => {
      const initData =
        getInitData<WorkflowInput>();

      if (
        !Array.isArray(inputData) ||
        inputData.length !==
          initData.evidence.length ||
        inputData.some(
          (item) => !item?.success,
        )
      ) {
        throw new Error(
          "One or more evidence persistence operations failed.",
        );
      }

      const firstEvidence =
        inputData.find(
          (item) => item?.success,
        );

      if (!firstEvidence?.success) {
        throw new Error(
          "No successfully persisted evidence record was available.",
        );
      }

      if (!initData.contact.available) {
        return [];
      }

      return [
        {
          prospectId:
            firstEvidence.prospect.id,

          name:
            nullToUndefined(initData.contact.name),

          jobTitle:
            nullToUndefined(initData.contact.jobTitle),

          email:
            nullToUndefined(initData.contact.email),

          phone:
            nullToUndefined(initData.contact.phone),

          contactPageUrl:
            nullToUndefined(initData.contact.contactPageUrl),

          sourceUrl:
            initData.contact.sourceUrl,

          contactType:
            initData.contact.contactType,

          verificationStatus:
            initData.contact
              .verificationStatus,

          isPublic: true as const,
        },
      ];
    })

    .foreach(saveContactStep)

    /*
     * A requested public contact must actually
     * persist successfully. An intentionally
     * unavailable contact produces [] and is valid.
     */
    .map(async ({
      inputData,
      getInitData,
      getStepResult,
    }) => {
      const initData =
        getInitData<WorkflowInput>();

      if (
        initData.contact.available &&
        (
          inputData.length !== 1 ||
          !inputData[0]?.success
        )
      ) {
        throw new Error(
          "The public contact was expected but could not be persisted.",
        );
      }

      const evidenceResults =
        getStepResult(saveEvidenceStep);

      if (
        !Array.isArray(evidenceResults) ||
        evidenceResults.length !==
          initData.evidence.length ||
        evidenceResults.some(
          (item) => !item?.success,
        )
      ) {
        throw new Error(
          "Research evidence persistence could not be fully verified.",
        );
      }

      const firstEvidence =
        evidenceResults.find(
          (item) => item?.success,
        );

      if (!firstEvidence?.success) {
        throw new Error(
          "No persisted evidence record was available for qualification.",
        );
      }

      return {
        prospectId:
          firstEvidence.prospect.id,

        status:
          initData.qualification.status,

        icpFitScore:
          initData.qualification
            .icpFitScore,

        reason:
          initData.qualification.reason,
      };
    })

    .then(qualifyProspectStep)

    /*
     * Final step independently re-reads the DB.
     */
    .then(finalVerificationStep)

    .commit();
