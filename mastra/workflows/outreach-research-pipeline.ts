import { RequestContext } from "@mastra/core/request-context";

import { kubaOutreachResearcherAgent } from "@/mastra/agents/outreach-researcher";
import { outreachProspectWorkflow } from "@/mastra/workflows/outreach-prospect-workflow";
import { saveOutreachProspectTool } from "@/mastra/tools/save-outreach-prospect";
import {
  outreachResearchPackageSchema,
  type OutreachResearchPackage,
} from "@/mastra/schemas/outreach-research-package";

/*
 * Kuba Outreach autonomous research pipeline.
 *
 * This is the ONLY place the research-only agent's output ever reaches a
 * database:
 *
 *   1. kubaOutreachResearcherAgent researches and INTERPRETS. It runs with a
 *      strict structuredOutput schema, so a malformed response throws here
 *      rather than being silently coerced or trusted.
 *   2. outreachProspectWorkflow (deterministic SuperKuba code) PERSISTS and
 *      independently re-reads the database to VERIFY what actually
 *      happened.
 *
 * Every id, status, and count in the returned result comes from the
 * workflow's own database-verified output — never from the model's
 * structured object. The model's package is only ever handed to the
 * workflow's inputSchema; it is never used as a source of persisted truth.
 */

export type OutreachResearchPipelineResult =
  | {
      stage: "research";
      success: false;
      message: string;
      error: string;
    }
  | {
      stage: "persistence";
      success: false;
      status: "identity_conflict";
      message: string;
      conflict: {
        existingProspectId: string;
        existingCompanyName: string;
        incomingCompanyName: string;
        normalizedDomain: string | null;
        promotedLeadId: string | null;
      };
      researchPackage: OutreachResearchPackage;
    }
  | {
      stage: "persistence";
      success: false;
      status: "pipeline_error";
      message: string;
      error: string | null;
      researchPackage: OutreachResearchPackage;
    }
  | {
      stage: "persistence";
      researchPackage: OutreachResearchPackage;
      success: boolean;
      status: "completed" | "partial" | "failed";
      prospectId: string | null;
      evidenceIds: string[];
      evidenceCount: number;
      contactId: string | null;
      prospectPersisted: boolean;
      evidencePersisted: boolean;
      contactPersisted: boolean;
      contactUnavailable: boolean;
      qualificationPersisted: boolean;
      qualificationStatus:
        | "qualified"
        | "nurture"
        | "disqualified"
        | null;
      icpFitScore: number | null;
      message: string;
    };

/*
 * Cost/token instrumentation.
 *
 * Point-in-time list price for the researcher's model (gpt-4o), USD per
 * million tokens. Update this if OpenAI's pricing changes — it is only used
 * to turn real, provider-reported token counts into an approximate dollar
 * figure for cost visibility; it never substitutes for actual billing data.
 */
const RESEARCHER_MODEL_ID = "gpt-4o";
const RESEARCHER_MODEL_PRICING_USD_PER_MILLION_TOKENS = {
  input: 2.5,
  output: 10,
};

function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) *
      RESEARCHER_MODEL_PRICING_USD_PER_MILLION_TOKENS.input +
    (outputTokens / 1_000_000) *
      RESEARCHER_MODEL_PRICING_USD_PER_MILLION_TOKENS.output
  );
}

type ResearcherToolCall = {
  payload?: { toolName?: string };
};

function summarizeToolCalls(toolCalls: ResearcherToolCall[] | undefined) {
  const byTool: Record<string, number> = {};

  for (const call of toolCalls ?? []) {
    const name = call?.payload?.toolName ?? "unknown";
    byTool[name] = (byTool[name] ?? 0) + 1;
  }

  return {
    total: toolCalls?.length ?? 0,
    byTool,
  };
}

/**
 * Emits exactly one structured JSON log line per research run, so a
 * rate-limit or cost problem is greppable (by businessId, prospect name, or
 * token count) instead of requiring someone to read a stack trace to find
 * it. Token counts come from the provider's own usage response, never
 * estimated from string/character length.
 */
function logResearchRun(entry: {
  businessId: string;
  employeeId: string;
  prospectName: string | null;
  stage: "research" | "persistence";
  outcome: string;
  qualification: {
    status: string | null;
    icpFitScore: number | null;
    source: "persisted" | "proposed" | "none";
  };
  tokens: {
    input: number;
    output: number;
    total: number;
    cachedInput: number;
  } | null;
  toolCalls: { total: number; byTool: Record<string, number> } | null;
  durationMs: number;
}) {
  const estimatedCostUsd = entry.tokens
    ? estimateCostUsd(entry.tokens.input, entry.tokens.output)
    : null;

  console.log(
    JSON.stringify({
      event: "kuba_outreach_research_run",
      timestamp: new Date().toISOString(),
      model: RESEARCHER_MODEL_ID,
      ...entry,
      estimatedCostUsd,
    }),
  );
}

export async function runOutreachResearchPipeline({
  businessId,
  employeeId,
  task,
  businessContext,
  onResearchComplete,
}: {
  businessId: string;
  employeeId: string;
  task: string;
  businessContext: string;
  /**
   * Optional hook invoked with the researcher's raw generate() result (the
   * same value the pipeline reads tokens/toolCalls from) right after the
   * research call succeeds, before persistence. Exists for auditing and
   * testing — e.g. verifying every persisted evidence sourceUrl traces
   * back to a URL the agent actually touched during this exact run — not
   * for production control flow. The pipeline's own behavior does not
   * depend on it.
   */
  onResearchComplete?: (researchResult: {
    object: unknown;
    finishReason: string | undefined;
    toolCalls: unknown[];
    toolResults: unknown[];
    sources: unknown[];
  }) => void;
}): Promise<OutreachResearchPipelineResult> {
  const startedAt = Date.now();

  function researchFailed(
    errorMessage: string,
    partialTokens: {
      input: number;
      output: number;
      total: number;
      cachedInput: number;
    } | null,
    partialToolCalls: { total: number; byTool: Record<string, number> } | null,
  ): OutreachResearchPipelineResult {
    logResearchRun({
      businessId,
      employeeId,
      prospectName: null,
      stage: "research",
      outcome: "research_failed",
      qualification: { status: null, icpFitScore: null, source: "none" },
      tokens: partialTokens,
      toolCalls: partialToolCalls,
      durationMs: Date.now() - startedAt,
    });

    return {
      stage: "research",
      success: false,
      message:
        "Kuba Outreach was unable to produce a valid, verifiable research package. Nothing was saved.",
      error: errorMessage,
    };
  }

  let researchPackage: OutreachResearchPackage;
  let tokens: {
    input: number;
    output: number;
    total: number;
    cachedInput: number;
  };
  let toolCalls: { total: number; byTool: Record<string, number> };

  try {
    const researchResult = await kubaOutreachResearcherAgent.generate(
      `${businessContext}\n\nRESEARCH TASK\n\n${task}`,
      {
        structuredOutput: {
          schema: outreachResearchPackageSchema,
          errorStrategy: "strict",
        },

        requestContext: new RequestContext([
          ["businessId", businessId],
        ]),
      },
    );

    tokens = {
      input: researchResult.usage?.inputTokens ?? 0,
      output: researchResult.usage?.outputTokens ?? 0,
      total: researchResult.usage?.totalTokens ?? 0,
      cachedInput: researchResult.usage?.cachedInputTokens ?? 0,
    };

    toolCalls = summarizeToolCalls(
      researchResult.toolCalls as ResearcherToolCall[] | undefined,
    );

    onResearchComplete?.({
      object: researchResult.object,
      finishReason: researchResult.finishReason,
      toolCalls: researchResult.toolCalls ?? [],
      toolResults: researchResult.toolResults ?? [],
      sources: researchResult.sources ?? [],
    });

    /*
     * A non-throwing call is not the same guarantee as "a valid package was
     * produced": the agent can exhaust its step/token budget while still
     * mid-research (finishReason "length" or "tool-calls") and return with
     * no final structured object at all. errorStrategy "strict" only
     * governs an object that WAS produced but failed schema validation, so
     * this case is checked explicitly rather than assumed away.
     */
    if (!researchResult.object) {
      return researchFailed(
        `The researcher did not produce a final structured result (finishReason: ${researchResult.finishReason}). It may have run out of research steps or output budget before concluding.`,
        tokens,
        toolCalls,
      );
    }

    /*
     * `researchResult.object` is typed through Mastra's own generic
     * structured-output inference chain, which TypeScript treats as a
     * distinct (if structurally identical) type from a plain
     * `z.infer<typeof outreachResearchPackageSchema>`. The runtime value is
     * the same schema-validated object either way — `generate()` already
     * enforced `outreachResearchPackageSchema` with `errorStrategy: "strict"`
     * above, so this is a type-system seam, not a validation gap.
     */
    researchPackage = researchResult.object as OutreachResearchPackage;
  } catch (error) {
    return researchFailed(
      error instanceof Error ? error.message : "Unknown research error.",
      null,
      null,
    );
  }

  const prospectName = researchPackage.prospect.companyName;

  const run = await outreachProspectWorkflow.createRun();

  // Same type-system seam as above, at the workflow's own generic input type.
  const workflowResult = await run.start({
    inputData: researchPackage,

    requestContext: new RequestContext([
      ["businessId", businessId],
      ["employeeId", employeeId],
    ]),
  } as Parameters<typeof run.start>[0]);

  if (workflowResult.status === "success") {
    logResearchRun({
      businessId,
      employeeId,
      prospectName,
      stage: "persistence",
      outcome: workflowResult.result.status,
      qualification: {
        status: workflowResult.result.qualificationStatus,
        icpFitScore: workflowResult.result.icpFitScore,
        source: workflowResult.result.qualificationPersisted
          ? "persisted"
          : "proposed",
      },
      tokens,
      toolCalls,
      durationMs: Date.now() - startedAt,
    });

    return {
      stage: "persistence",
      researchPackage,
      ...workflowResult.result,
    };
  }

  const prospectStepOutput = (
    workflowResult.steps as Record<
      string,
      { output?: unknown } | undefined
    >
  )?.[saveOutreachProspectTool.id]?.output as
    | {
        success: false;
        code: "IDENTITY_CONFLICT";
        conflict: {
          existingProspectId: string;
          existingCompanyName: string;
          incomingCompanyName: string;
          normalizedDomain: string | null;
          promotedLeadId: string | null;
        };
      }
    | undefined;

  if (prospectStepOutput?.code === "IDENTITY_CONFLICT") {
    logResearchRun({
      businessId,
      employeeId,
      prospectName,
      stage: "persistence",
      outcome: "identity_conflict",
      qualification: {
        status: researchPackage.qualification.status,
        icpFitScore: researchPackage.qualification.icpFitScore,
        source: "proposed",
      },
      tokens,
      toolCalls,
      durationMs: Date.now() - startedAt,
    });

    return {
      stage: "persistence",
      success: false,
      status: "identity_conflict",
      message:
        "Kuba Outreach found a possible identity conflict with an existing prospect and stopped before saving any research evidence. This requires manual entity-resolution review; no company identity was silently chosen or merged.",
      conflict: prospectStepOutput.conflict,
      researchPackage,
    };
  }

  logResearchRun({
    businessId,
    employeeId,
    prospectName,
    stage: "persistence",
    outcome: "pipeline_error",
    qualification: {
      status: researchPackage.qualification.status,
      icpFitScore: researchPackage.qualification.icpFitScore,
      source: "proposed",
    },
    tokens,
    toolCalls,
    durationMs: Date.now() - startedAt,
  });

  return {
    stage: "persistence",
    success: false,
    status: "pipeline_error",
    message:
      "The deterministic Outreach persistence workflow did not complete. Nothing should be assumed saved beyond what independent verification confirms.",
    error:
      "error" in workflowResult && workflowResult.error instanceof Error
        ? workflowResult.error.message
        : null,
    researchPackage,
  };
}
